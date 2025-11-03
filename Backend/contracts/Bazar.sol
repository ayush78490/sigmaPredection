// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Simple ERC20 for outcome tokens
contract OutcomeToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable market;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _market) {
        name = _name;
        symbol = _symbol;
        market = _market;
    }

    modifier onlyMarket() {
        require(msg.sender == market, "only market");
        _;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0), "zero address");
        require(balanceOf[msg.sender] >= value, "insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0), "zero address");
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        require(balanceOf[from] >= value, "insufficient balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external onlyMarket {
        require(to != address(0), "zero address");
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }

    function burn(address from, uint256 value) external onlyMarket {
        require(balanceOf[from] >= value, "insufficient balance");
        unchecked {
            balanceOf[from] -= value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }
}

// --------------------------------------------------------------------

contract PredictionMarketFactory {
    enum MarketStatus { Open, Closed, Proposed, Disputed, Resolved }
    enum Outcome { Undecided, Yes, No, Invalid }

    struct Market {
        address creator;
        string question;
        uint256 endTime;
        MarketStatus status;
        Outcome outcome;
        OutcomeToken yesToken;
        OutcomeToken noToken;
        uint256 yesPool;
        uint256 noPool;
        uint256 lpTotalSupply;
        uint256 totalBacking;
        uint256 platformFees;
        // Proposal system
        address proposer;
        Outcome proposedOutcome;
        uint256 proposalTime;
        uint256 proposalBond;
        uint256 disputeBond;
        address disputer;
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public lpBalances;
    
    // Oracle system
    mapping(address => bool) public isOracle;
    address[] public oracles;
    uint256 public requiredOracleVotes;
    mapping(uint256 => mapping(address => Outcome)) public oracleVotes;
    mapping(uint256 => mapping(Outcome => uint256)) public outcomeVoteCount;

    address public owner;
    uint32 public feeBps;
    uint32 public lpFeeBps;
    
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant MIN_INITIAL_LIQUIDITY = 0.01 ether;
    uint256 public constant CHALLENGE_PERIOD = 2 hours;
    uint256 public constant PROPOSAL_BOND = 0.1 ether;
    uint256 public constant DISPUTE_BOND = 0.1 ether;
    
    uint256 private _lock = 1;

    event MarketCreated(uint256 indexed id, string question, address yesToken, address noToken, uint256 endTime);
    event CompleteSetMinted(uint256 indexed id, address indexed user, uint256 amount);
    event CompleteSetBurned(uint256 indexed id, address indexed user, uint256 amount);
    event LiquidityAdded(uint256 indexed id, address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 lpTokens);
    event LiquidityRemoved(uint256 indexed id, address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 lpTokens);
    event Swap(uint256 indexed id, address indexed user, bool yesIn, uint256 amountIn, uint256 amountOut, uint256 fee);
    event MarketClosed(uint256 indexed id);
    event OutcomeProposed(uint256 indexed id, address indexed proposer, Outcome outcome, uint256 bond);
    event ProposalDisputed(uint256 indexed id, address indexed disputer, uint256 bond);
    event OracleVoted(uint256 indexed id, address indexed oracle, Outcome outcome);
    event Resolved(uint256 indexed id, Outcome outcome);
    event Redeemed(uint256 indexed id, address indexed user, uint256 amount, uint256 payout);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(_lock == 1, "reentrancy");
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier marketExists(uint256 id) {
        require(id < nextMarketId, "market does not exist");
        _;
    }

    constructor(uint32 _feeBps, uint32 _lpFeeBps) {
        require(_feeBps <= 500, "fee too high");
        require(_lpFeeBps <= 10000, "LP share invalid");
        owner = msg.sender;
        feeBps = _feeBps;
        lpFeeBps = _lpFeeBps;
        requiredOracleVotes = 1; // Start with 1, increase as oracles are added
    }

    // ---------------------------------------------------------------
    // Oracle Management
    // ---------------------------------------------------------------
    
    function addOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "zero address");
        require(!isOracle[oracle], "already oracle");
        
        isOracle[oracle] = true;
        oracles.push(oracle);
        
        // Require 51% of oracles to resolve
        requiredOracleVotes = (oracles.length / 2) + 1;
        
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyOwner {
        require(isOracle[oracle], "not oracle");
        
        isOracle[oracle] = false;
        
        // Remove from array
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracle) {
                oracles[i] = oracles[oracles.length - 1];
                oracles.pop();
                break;
            }
        }
        
        if (oracles.length > 0) {
            requiredOracleVotes = (oracles.length / 2) + 1;
        } else {
            requiredOracleVotes = 1;
        }
        
        emit OracleRemoved(oracle);
    }

    function getOracles() external view returns (address[] memory) {
        return oracles;
    }

    // ---------------------------------------------------------------
    // Market Creation
    // ---------------------------------------------------------------
    
    function createMarket(
        string calldata question,
        uint256 endTime,
        uint256 initialYes,
        uint256 initialNo
    ) external payable nonReentrant returns (uint256) {
        require(endTime > block.timestamp + 1 hours, "end time too soon");
        require(bytes(question).length > 0 && bytes(question).length <= 280, "invalid question");
        require(initialYes > 0 && initialNo > 0, "need initial liquidity");
        
        uint256 totalRequired = initialYes + initialNo;
        require(totalRequired >= MIN_INITIAL_LIQUIDITY, "liquidity too low");
        require(msg.value >= totalRequired, "insufficient BNB");

        uint256 id = nextMarketId++;

        OutcomeToken yesToken = new OutcomeToken(
            string.concat("YES: ", _truncate(question, 50)),
            string.concat("YES", _toString(id)),
            address(this)
        );
        
        OutcomeToken noToken = new OutcomeToken(
            string.concat("NO: ", _truncate(question, 50)),
            string.concat("NO", _toString(id)),
            address(this)
        );

        markets[id] = Market({
            creator: msg.sender,
            question: question,
            endTime: endTime,
            status: MarketStatus.Open,
            outcome: Outcome.Undecided,
            yesToken: yesToken,
            noToken: noToken,
            yesPool: initialYes,
            noPool: initialNo,
            lpTotalSupply: 0,
            totalBacking: totalRequired,
            platformFees: 0,
            proposer: address(0),
            proposedOutcome: Outcome.Undecided,
            proposalTime: 0,
            proposalBond: 0,
            disputeBond: 0,
            disputer: address(0)
        });

        yesToken.mint(address(this), totalRequired);
        noToken.mint(address(this), totalRequired);

        uint256 liquidity = _sqrt(initialYes * initialNo);
        require(liquidity > MINIMUM_LIQUIDITY, "insufficient liquidity value");
        
        markets[id].lpTotalSupply = liquidity;
        lpBalances[id][msg.sender] = liquidity - MINIMUM_LIQUIDITY;
        lpBalances[id][address(1)] = MINIMUM_LIQUIDITY;

        if (msg.value > totalRequired) {
            _transferBNB(msg.sender, msg.value - totalRequired);
        }

        emit MarketCreated(id, question, address(yesToken), address(noToken), endTime);
        emit LiquidityAdded(id, msg.sender, initialYes, initialNo, liquidity - MINIMUM_LIQUIDITY);
        
        return id;
    }

    // ---------------------------------------------------------------
    // Complete Sets
    // ---------------------------------------------------------------
    
    function mintCompleteSets(uint256 id, uint256 amount) 
        external 
        payable 
        nonReentrant 
        marketExists(id) 
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "market not open");
        require(msg.value == amount, "incorrect BNB");
        require(amount > 0, "zero amount");

        m.totalBacking += amount;
        m.yesToken.mint(msg.sender, amount);
        m.noToken.mint(msg.sender, amount);

        emit CompleteSetMinted(id, msg.sender, amount);
    }

    function burnCompleteSets(uint256 id, uint256 amount) 
        external 
        nonReentrant 
        marketExists(id) 
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "market not open");
        require(amount > 0, "zero amount");

        m.yesToken.burn(msg.sender, amount);
        m.noToken.burn(msg.sender, amount);
        m.totalBacking -= amount;

        _transferBNB(msg.sender, amount);
        emit CompleteSetBurned(id, msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Trading
    // ---------------------------------------------------------------
    
    function swapYesForNo(uint256 id, uint256 yesIn, uint256 minNoOut) 
        external 
        nonReentrant 
        marketExists(id) 
    {
        _swap(id, true, yesIn, minNoOut);
    }

    function swapNoForYes(uint256 id, uint256 noIn, uint256 minYesOut) 
        external 
        nonReentrant 
        marketExists(id) 
    {
        _swap(id, false, noIn, minYesOut);
    }

    function _swap(uint256 id, bool yesIn, uint256 amountIn, uint256 minOut) internal {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "market not open");
        require(block.timestamp < m.endTime, "market ended");
        require(amountIn > 0, "zero input");

        uint256 platformFee = (amountIn * feeBps) / 10000;
        uint256 lpFee = (platformFee * lpFeeBps) / 10000;
        uint256 protocolFee = platformFee - lpFee;
        uint256 amountInAfterFee = amountIn - platformFee;

        m.platformFees += protocolFee;

        uint256 amountOut;
        if (yesIn) {
            amountOut = _getAmountOut(amountInAfterFee, m.yesPool, m.noPool);
            require(amountOut >= minOut, "slippage exceeded");
            require(amountOut < m.noPool, "insufficient liquidity");
            
            m.yesToken.burn(msg.sender, amountIn);
            m.yesPool += amountInAfterFee + lpFee;
            m.noPool -= amountOut;
            m.noToken.mint(msg.sender, amountOut);
        } else {
            amountOut = _getAmountOut(amountInAfterFee, m.noPool, m.yesPool);
            require(amountOut >= minOut, "slippage exceeded");
            require(amountOut < m.yesPool, "insufficient liquidity");
            
            m.noToken.burn(msg.sender, amountIn);
            m.noPool += amountInAfterFee + lpFee;
            m.yesPool -= amountOut;
            m.yesToken.mint(msg.sender, amountOut);
        }

        emit Swap(id, msg.sender, yesIn, amountIn, amountOut, platformFee);
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        internal 
        pure 
        returns (uint256) 
    {
        require(reserveIn > 0 && reserveOut > 0, "insufficient liquidity");
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        return numerator / denominator;
    }

    // ---------------------------------------------------------------
    // Liquidity
    // ---------------------------------------------------------------
    
    function addLiquidity(
        uint256 id,
        uint256 yesAmount,
        uint256 noAmount,
        uint256 minLPTokens
    ) external nonReentrant marketExists(id) returns (uint256 lpTokens) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "market not open");
        require(yesAmount > 0 && noAmount > 0, "zero amount");

        m.yesToken.burn(msg.sender, yesAmount);
        m.noToken.burn(msg.sender, noAmount);

        uint256 totalSupply = m.lpTotalSupply;
        lpTokens = _min(
            (yesAmount * totalSupply) / m.yesPool,
            (noAmount * totalSupply) / m.noPool
        );
        require(lpTokens >= minLPTokens, "insufficient LP tokens");
        require(lpTokens > 0, "zero LP tokens");

        m.yesPool += yesAmount;
        m.noPool += noAmount;
        m.lpTotalSupply += lpTokens;
        lpBalances[id][msg.sender] += lpTokens;

        emit LiquidityAdded(id, msg.sender, yesAmount, noAmount, lpTokens);
    }

    function removeLiquidity(
        uint256 id,
        uint256 lpTokens,
        uint256 minYes,
        uint256 minNo
    ) external nonReentrant marketExists(id) returns (uint256 yesAmount, uint256 noAmount) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "market not open");
        require(lpTokens > 0, "zero LP tokens");
        require(lpBalances[id][msg.sender] >= lpTokens, "insufficient LP balance");

        uint256 totalSupply = m.lpTotalSupply;
        yesAmount = (lpTokens * m.yesPool) / totalSupply;
        noAmount = (lpTokens * m.noPool) / totalSupply;

        require(yesAmount >= minYes && noAmount >= minNo, "slippage exceeded");
        require(yesAmount > 0 && noAmount > 0, "zero output");

        lpBalances[id][msg.sender] -= lpTokens;
        m.lpTotalSupply -= lpTokens;
        m.yesPool -= yesAmount;
        m.noPool -= noAmount;

        m.yesToken.mint(msg.sender, yesAmount);
        m.noToken.mint(msg.sender, noAmount);

        emit LiquidityRemoved(id, msg.sender, yesAmount, noAmount, lpTokens);
    }

    // ---------------------------------------------------------------
    // Resolution: Community Proposal + Oracle Voting System
    // ---------------------------------------------------------------
    
    function closeMarket(uint256 id) external marketExists(id) {
        Market storage m = markets[id];
        require(msg.sender == m.creator || msg.sender == owner, "not authorized");
        require(m.status == MarketStatus.Open, "not open");
        require(block.timestamp >= m.endTime, "not ended");
        
        m.status = MarketStatus.Closed;
        emit MarketClosed(id);
    }

    /// @notice Anyone can propose outcome with a bond
    function proposeOutcome(uint256 id, Outcome outcome) external payable nonReentrant marketExists(id) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Closed, "not closed");
        require(outcome == Outcome.Yes || outcome == Outcome.No || outcome == Outcome.Invalid, "invalid outcome");
        require(msg.value >= PROPOSAL_BOND, "insufficient bond");

        m.proposer = msg.sender;
        m.proposedOutcome = outcome;
        m.proposalTime = block.timestamp;
        m.proposalBond = msg.value;
        m.status = MarketStatus.Proposed;

        emit OutcomeProposed(id, msg.sender, outcome, msg.value);
    }

    /// @notice Anyone can dispute a proposal within challenge period
    function disputeProposal(uint256 id) external payable nonReentrant marketExists(id) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Proposed, "not proposed");
        require(block.timestamp < m.proposalTime + CHALLENGE_PERIOD, "challenge period ended");
        require(msg.value >= DISPUTE_BOND, "insufficient bond");
        require(msg.sender != m.proposer, "proposer cannot dispute");

        m.disputer = msg.sender;
        m.disputeBond = msg.value;
        m.status = MarketStatus.Disputed;

        emit ProposalDisputed(id, msg.sender, msg.value);
    }

    /// @notice Oracles vote on disputed markets (or after challenge period)
    function oracleVote(uint256 id, Outcome outcome) external marketExists(id) {
        require(isOracle[msg.sender], "not oracle");
        Market storage m = markets[id];
        require(
            m.status == MarketStatus.Disputed || 
            (m.status == MarketStatus.Proposed && block.timestamp >= m.proposalTime + CHALLENGE_PERIOD),
            "cannot vote yet"
        );
        require(outcome == Outcome.Yes || outcome == Outcome.No || outcome == Outcome.Invalid, "invalid outcome");
        require(oracleVotes[id][msg.sender] == Outcome.Undecided, "already voted");

        // Decrement old vote if exists
        if (oracleVotes[id][msg.sender] != Outcome.Undecided) {
            outcomeVoteCount[id][oracleVotes[id][msg.sender]]--;
        }

        // Record new vote
        oracleVotes[id][msg.sender] = outcome;
        outcomeVoteCount[id][outcome]++;

        emit OracleVoted(id, msg.sender, outcome);

        // Check if we have enough votes to resolve
        if (outcomeVoteCount[id][outcome] >= requiredOracleVotes) {
            _finalizeResolution(id, outcome);
        }
    }

    /// @notice Finalize resolution after challenge period (if no dispute)
    function finalizeProposal(uint256 id) external nonReentrant marketExists(id) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Proposed, "not proposed");
        require(block.timestamp >= m.proposalTime + CHALLENGE_PERIOD, "challenge period active");

        // No dispute, proposal accepted
        _finalizeResolution(id, m.proposedOutcome);
        
        // Return bond to proposer
        _transferBNB(m.proposer, m.proposalBond);
        m.proposalBond = 0;
    }

    function _finalizeResolution(uint256 id, Outcome outcome) internal {
        Market storage m = markets[id];
        m.outcome = outcome;
        m.status = MarketStatus.Resolved;

        // Handle bonds
        if (m.status == MarketStatus.Disputed) {
            // Check who was right
            if (outcome == m.proposedOutcome) {
                // Proposer was right, gets both bonds
                uint256 totalBonds = m.proposalBond + m.disputeBond;
                _transferBNB(m.proposer, totalBonds);
            } else {
                // Disputer was right, gets both bonds
                uint256 totalBonds = m.proposalBond + m.disputeBond;
                _transferBNB(m.disputer, totalBonds);
            }
            m.proposalBond = 0;
            m.disputeBond = 0;
        }

        emit Resolved(id, outcome);
    }

    // ---------------------------------------------------------------
    // Redemption
    // ---------------------------------------------------------------
    
    function redeem(uint256 id) external nonReentrant marketExists(id) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Resolved, "not resolved");

        if (m.outcome == Outcome.Invalid) {
            // Invalid market: return proportional backing (1:1 for all tokens)
            uint256 yesBalance = m.yesToken.balanceOf(msg.sender);
            uint256 noBalance = m.noToken.balanceOf(msg.sender);
            
            uint256 payout = yesBalance + noBalance;
            require(payout > 0, "no tokens");
            
            if (yesBalance > 0) m.yesToken.burn(msg.sender, yesBalance);
            if (noBalance > 0) m.noToken.burn(msg.sender, noBalance);
            
            _transferBNB(msg.sender, payout);
            emit Redeemed(id, msg.sender, payout, payout);
        } else {
            // Normal resolution: winners get 1 BNB per token
            uint256 winningTokens;
            if (m.outcome == Outcome.Yes) {
                winningTokens = m.yesToken.balanceOf(msg.sender);
                require(winningTokens > 0, "no winning tokens");
                m.yesToken.burn(msg.sender, winningTokens);
            } else {
                winningTokens = m.noToken.balanceOf(msg.sender);
                require(winningTokens > 0, "no winning tokens");
                m.noToken.burn(msg.sender, winningTokens);
            }

            _transferBNB(msg.sender, winningTokens);
            emit Redeemed(id, msg.sender, winningTokens, winningTokens);
        }
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------
    
    function getMarket(uint256 id) external view marketExists(id) returns (
        address creator,
        string memory question,
        uint256 endTime,
        MarketStatus status,
        Outcome outcome,
        address yesToken,
        address noToken,
        uint256 yesPool,
        uint256 noPool,
        uint256 lpTotalSupply,
        uint256 totalBacking
    ) {
        Market storage m = markets[id];
        return (
            m.creator,
            m.question,
            m.endTime,
            m.status,
            m.outcome,
            address(m.yesToken),
            address(m.noToken),
            m.yesPool,
            m.noPool,
            m.lpTotalSupply,
            m.totalBacking
        );
    }

    function getProposalInfo(uint256 id) external view marketExists(id) returns (
        address proposer,
        Outcome proposedOutcome,
        uint256 proposalTime,
        uint256 proposalBond,
        address disputer,
        uint256 disputeBond
    ) {
        Market storage m = markets[id];
        return (
            m.proposer,
            m.proposedOutcome,
            m.proposalTime,
            m.proposalBond,
            m.disputer,
            m.disputeBond
        );
    }

    function getOracleVotes(uint256 id) external view marketExists(id) returns (
        uint256 yesVotes,
        uint256 noVotes,
        uint256 invalidVotes
    ) {
        return (
            outcomeVoteCount[id][Outcome.Yes],
            outcomeVoteCount[id][Outcome.No],
            outcomeVoteCount[id][Outcome.Invalid]
        );
    }

    function getPrice(uint256 id) external view marketExists(id) returns (uint256 yesPrice, uint256 noPrice) {
        Market storage m = markets[id];
        uint256 total = m.yesPool + m.noPool;
        if (total == 0) return (5000, 5000);
        
        yesPrice = (m.noPool * 10000) / total;
        noPrice = (m.yesPool * 10000) / total;
    }

    function getAmountOut(uint256 id, uint256 amountIn, bool yesIn) 
        external 
        view 
        marketExists(id)
        returns (uint256 amountOut, uint256 fee) 
    {
        Market storage m = markets[id];
        fee = (amountIn * feeBps) / 10000;
        uint256 amountInAfterFee = amountIn - fee;
        
        if (yesIn) {
            amountOut = _getAmountOut(amountInAfterFee, m.yesPool, m.noPool);
        } else {
            amountOut = _getAmountOut(amountInAfterFee, m.noPool, m.yesPool);
        }
    }

    function getLPBalance(uint256 id, address user) external view returns (uint256) {
        return lpBalances[id][user];
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------
    
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 totalFees;
        for (uint256 i = 0; i < nextMarketId; i++) {
            totalFees += markets[i].platformFees;
            markets[i].platformFees = 0;
        }
        require(totalFees > 0, "no fees");
        _transferBNB(owner, totalFees);
        emit FeesWithdrawn(owner, totalFees);
    }

    function setFees(uint32 newFeeBps, uint32 newLpFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "fee too high");
        require(newLpFeeBps <= 10000, "LP share invalid");
        feeBps = newFeeBps;
        lpFeeBps = newLpFeeBps;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    // Emergency: Owner can resolve if oracle system fails
    function emergencyResolve(uint256 id, Outcome outcome) external onlyOwner marketExists(id) {
        Market storage m = markets[id];
        require(m.status != MarketStatus.Resolved, "already resolved");
        require(m.status != MarketStatus.Open, "market still open");
        _finalizeResolution(id, outcome);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    
    function _transferBNB(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "transfer failed");
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _truncate(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;
        
        bytes memory result = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            result[i] = strBytes[i];
        }
        return string(result);
    }

    receive() external payable {}
}