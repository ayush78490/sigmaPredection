// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice simple ERC20 implementation for outcome shares
contract OutcomeToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public market; // prediction market that controls mint/burn

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    modifier onlyMarket() {
        require(msg.sender == market, "only market");
        _;
    }

    constructor(string memory _name, string memory _symbol, address _market) {
        name = _name;
        symbol = _symbol;
        market = _market;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external onlyMarket {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function burn(address from, uint256 value) external onlyMarket {
        require(balanceOf[from] >= value, "balance");
        unchecked {
            balanceOf[from] -= value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }
}

// --------------------------------------------------------------------

contract PredictionMarketFactory {
    enum MarketStatus { Open, Closed, Resolved }
    enum Outcome { Undecided, Yes, No }

    struct Market {
        address creator;
        string question;
        uint256 endTime;
        MarketStatus status;
        Outcome outcome;
        OutcomeToken yesToken;
        OutcomeToken noToken;
        uint256 yesPool; // BNB reserves
        uint256 noPool;
        uint256 k;       // constant product
        uint256 fees;    // accumulated platform fee
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => bool) public marketExists;

    address public owner;
    address public oracle;
    uint32  public feeBps; // platform fee (e.g., 100 = 1%)

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier onlyOracle() { require(msg.sender == oracle || msg.sender == owner, "oracle"); _; }
    modifier nonReentrant() { require(_lock == 1); _lock = 2; _; _lock = 1; }
    uint256 private _lock = 1;

    event MarketCreated(uint256 id, string question, address yesToken, address noToken);
    event Traded(uint256 id, address user, bool buyYes, uint256 amountIn, uint256 tokensOut, uint256 fee);
    event Resolved(uint256 id, Outcome outcome);
    event Claimed(uint256 id, address user, uint256 payout);

    constructor(address _oracle, uint32 _feeBps) {
        owner = msg.sender;
        oracle = _oracle;
        feeBps = _feeBps;
    }

    // ---------------------------------------------------------------
    // Market creation
    // ---------------------------------------------------------------
    function createMarket(string calldata question, uint256 endTime) external returns (uint256) {
        require(endTime > block.timestamp + 1 hours, "short");
        uint256 id = nextMarketId++;
        OutcomeToken yes = new OutcomeToken(
            string(abi.encodePacked("Yes-", question)),
            string(abi.encodePacked("YES", id)),
            address(this)
        );
        OutcomeToken no = new OutcomeToken(
            string(abi.encodePacked("No-", question)),
            string(abi.encodePacked("NO", id)),
            address(this)
        );

        markets[id] = Market({
            creator: msg.sender,
            question: question,
            endTime: endTime,
            status: MarketStatus.Open,
            outcome: Outcome.Undecided,
            yesToken: yes,
            noToken: no,
            yesPool: 0,
            noPool: 0,
            k: 0,
            fees: 0
        });
        marketExists[id] = true;
        emit MarketCreated(id, question, address(yes), address(no));
        return id;
    }

    // ---------------------------------------------------------------
    // Trading (Uniswap x*y=k model)
    // ---------------------------------------------------------------
    function _applyFee(uint256 amount) internal view returns (uint256 afterFee, uint256 fee) {
        fee = (amount * feeBps) / 10000;
        afterFee = amount - fee;
    }

    function _getAmountOut(uint256 input, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        // amountOut = reserveOut - (k / (reserveIn + input))
        if (reserveIn == 0 || reserveOut == 0) return input; // initial liquidity
        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + input;
        uint256 newReserveOut = k / newReserveIn;
        return reserveOut - newReserveOut;
    }

    function buyYes(uint256 id) external payable nonReentrant {
        Market storage m = markets[id];
        require(marketExists[id], "no market");
        require(m.status == MarketStatus.Open && block.timestamp < m.endTime, "closed");
        require(msg.value > 0, "zero");

        (uint256 net, uint256 fee) = _applyFee(msg.value);
        uint256 amountOut = _getAmountOut(net, m.yesPool, m.noPool == 0 ? net : m.noPool);
        if (m.k == 0) {
            // bootstrap pool with equal reserves
            m.yesPool = net;
            m.noPool = net;
            m.k = net * net;
            amountOut = net;
        } else {
            m.yesPool += net;
            m.noPool -= amountOut;
            m.k = m.yesPool * m.noPool;
        }
        m.fees += fee;
        m.yesToken.mint(msg.sender, amountOut);

        emit Traded(id, msg.sender, true, msg.value, amountOut, fee);
    }

    function buyNo(uint256 id) external payable nonReentrant {
        Market storage m = markets[id];
        require(marketExists[id], "no market");
        require(m.status == MarketStatus.Open && block.timestamp < m.endTime, "closed");
        require(msg.value > 0, "zero");

        (uint256 net, uint256 fee) = _applyFee(msg.value);
        uint256 amountOut = _getAmountOut(net, m.noPool, m.yesPool == 0 ? net : m.yesPool);
        if (m.k == 0) {
            m.yesPool = net;
            m.noPool = net;
            m.k = net * net;
            amountOut = net;
        } else {
            m.noPool += net;
            m.yesPool -= amountOut;
            m.k = m.yesPool * m.noPool;
        }
        m.fees += fee;
        m.noToken.mint(msg.sender, amountOut);

        emit Traded(id, msg.sender, false, msg.value, amountOut, fee);
    }

    // Sell back outcome tokens for BNB
    function sellYes(uint256 id, uint256 amountIn) external nonReentrant {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "closed");
        require(amountIn > 0, "zero");
        m.yesToken.burn(msg.sender, amountIn);
        uint256 amountOut = _getAmountOut(amountIn, m.noPool, m.yesPool);
        (uint256 net, uint256 fee) = _applyFee(amountOut);
        m.fees += fee;
        m.yesPool -= net;
        m.noPool += amountIn;
        m.k = m.yesPool * m.noPool;

        (bool ok,) = msg.sender.call{value: net}("");
        require(ok, "transfer failed");
        emit Traded(id, msg.sender, false, amountIn, net, fee);
    }

    function sellNo(uint256 id, uint256 amountIn) external nonReentrant {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Open, "closed");
        require(amountIn > 0, "zero");
        m.noToken.burn(msg.sender, amountIn);
        uint256 amountOut = _getAmountOut(amountIn, m.yesPool, m.noPool);
        (uint256 net, uint256 fee) = _applyFee(amountOut);
        m.fees += fee;
        m.noPool -= net;
        m.yesPool += amountIn;
        m.k = m.yesPool * m.noPool;

        (bool ok,) = msg.sender.call{value: net}("");
        require(ok, "transfer failed");
        emit Traded(id, msg.sender, true, amountIn, net, fee);
    }

    // ---------------------------------------------------------------
    // Resolution & claim
    // ---------------------------------------------------------------
    function closeMarket(uint256 id) external {
        Market storage m = markets[id];
        require(msg.sender == m.creator || msg.sender == owner, "auth");
        require(m.status == MarketStatus.Open && block.timestamp >= m.endTime, "time");
        m.status = MarketStatus.Closed;
    }

    function resolveMarket(uint256 id, Outcome outcome) external onlyOracle {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Closed, "not closed");
        require(outcome != Outcome.Undecided, "bad");
        m.status = MarketStatus.Resolved;
        m.outcome = outcome;
        emit Resolved(id, outcome);
    }

    function claim(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Resolved, "unresolved");
        uint256 payout;
        if (m.outcome == Outcome.Yes) {
            uint256 bal = m.yesToken.balanceOf(msg.sender);
            require(bal > 0, "no yes");
            m.yesToken.burn(msg.sender, bal);
            payout = (address(this).balance * bal) / m.yesToken.totalSupply();
        } else if (m.outcome == Outcome.No) {
            uint256 bal = m.noToken.balanceOf(msg.sender);
            require(bal > 0, "no no");
            m.noToken.burn(msg.sender, bal);
            payout = (address(this).balance * bal) / m.noToken.totalSupply();
        }
        require(payout > 0, "zero");
        (bool ok,) = msg.sender.call{value: payout}("");
        require(ok, "send fail");
        emit Claimed(id, msg.sender, payout);
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------
    function withdrawFees(address payable to) external onlyOwner {
        uint256 total;
        for (uint256 i; i < nextMarketId; i++) total += markets[i].fees;
        require(total > 0, "none");
        (bool ok,) = to.call{value: total}("");
        require(ok, "send fail");
    }
}