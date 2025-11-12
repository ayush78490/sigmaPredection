// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOutcomeToken {
    function balanceOf(address account) external view returns (uint256);
}

interface IPredictionMarketCore {
    struct Market {
        address creator;
        string question;
        string category;
        uint256 endTime;
        uint8 status; // MarketStatus enum
        uint8 outcome; // Outcome enum
        address yesToken;
        address noToken;
        uint256 yesPool;
        uint256 noPool;
        uint256 lpTotalSupply;
        uint256 totalBacking;
        uint256 platformFees;
        uint256 resolutionRequestedAt;
        address resolutionRequester;
        string resolutionReason;
        uint256 resolutionConfidence;
        uint256 disputeDeadline;
        address disputer;
        string disputeReason;
    }

    struct UserInvestment {
        uint256 totalInvested;
        uint256 lastUpdated;
    }

    function markets(uint256) external view returns (
        address creator,
        string memory question,
        string memory category,
        uint256 endTime,
        uint8 status,
        uint8 outcome,
        address yesToken,
        address noToken,
        uint256 yesPool,
        uint256 noPool,
        uint256 lpTotalSupply,
        uint256 totalBacking,
        uint256 platformFees,
        uint256 resolutionRequestedAt,
        address resolutionRequester,
        string memory resolutionReason,
        uint256 resolutionConfidence,
        uint256 disputeDeadline,
        address disputer,
        string memory disputeReason
    );

    function userInvestments(uint256 marketId, address user) external view returns (
        uint256 totalInvested,
        uint256 lastUpdated
    );

    function nextMarketId() external view returns (uint256);
    function feeBps() external view returns (uint32);
    function lpFeeBps() external view returns (uint32);
}

/**
 * @title PredictionMarketHelper
 * @notice Helper contract providing view functions for the PredictionMarket
 * @dev This contract doesn't modify state, only reads from the main contract
 */
contract PredictionMarketHelper {
    IPredictionMarketCore public immutable predictionMarket;

    // Enums matching the main contract
    enum MarketStatus { Open, Closed, ResolutionRequested, Resolved, Disputed }
    enum Outcome { Undecided, Yes, No }

    struct UserPosition {
        uint256 marketId;
        uint256 yesBalance;
        uint256 noBalance;
        uint256 totalInvested;
        uint256 bnbInvested;
    }

    struct MultiplierInfo {
        uint256 multiplier; // Scaled by 10000 (e.g., 15000 = 1.5x)
        uint256 totalOut;
        uint256 totalFee;
    }

    struct TradingInfo {
        uint256 yesMultiplier;
        uint256 noMultiplier;
        uint256 yesPrice;
        uint256 noPrice;
        uint256 totalLiquidity;
    }

    constructor(address _predictionMarket) {
        require(_predictionMarket != address(0), "Invalid market address");
        predictionMarket = IPredictionMarketCore(_predictionMarket);
    }

    // ==================== USER INVESTMENT TRACKING ====================

    /**
     * @notice Get user's total BNB investment in a specific market
     * @param marketId The market ID
     * @param user The user address
     * @return Total BNB invested by user in this market
     */
    function getMarketInvestment(uint256 marketId, address user) 
        external 
        view 
        returns (uint256) 
    {
        (uint256 totalInvested, ) = predictionMarket.userInvestments(marketId, user);
        return totalInvested;
    }

    /**
     * @notice Get user's total BNB investment across all markets
     * @param user The user address
     * @return totalInvestment Total BNB invested across all markets
     */
    function getUserTotalInvestment(address user) 
        external 
        view 
        returns (uint256 totalInvestment) 
    {
        uint256 marketCount = predictionMarket.nextMarketId();
        
        for (uint256 i = 0; i < marketCount; i++) {
            (uint256 invested, ) = predictionMarket.userInvestments(i, user);
            totalInvestment += invested;
        }
        
        return totalInvestment;
    }

    /**
     * @notice Get all user positions across all markets
     * @param user The user address
     * @return positions Array of user positions
     */
    function getUserPositions(address user) 
        external 
        view 
        returns (UserPosition[] memory) 
    {
        uint256 marketCount = predictionMarket.nextMarketId();
        
        // First pass: count positions with balances
        uint256 positionCount = 0;
        for (uint256 i = 0; i < marketCount; i++) {
            try this._checkPosition(i, user) returns (bool hasPosition) {
                if (hasPosition) positionCount++;
            } catch {}
        }
        
        // Second pass: populate positions
        UserPosition[] memory positions = new UserPosition[](positionCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < marketCount; i++) {
            try this._getPosition(i, user) returns (UserPosition memory pos) {
                if (pos.yesBalance > 0 || pos.noBalance > 0) {
                    positions[index] = pos;
                    index++;
                }
            } catch {}
        }
        
        return positions;
    }

    /**
     * @dev Internal helper to check if user has position (external for try/catch)
     * @param marketId The market ID
     * @param user The user address
     * @return hasPosition True if user has YES or NO tokens
     */
    function _checkPosition(uint256 marketId, address user) 
        external 
        view 
        returns (bool hasPosition) 
    {
        (, , , , , , address yesToken, address noToken, , , , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 yesBalance = IOutcomeToken(yesToken).balanceOf(user);
        uint256 noBalance = IOutcomeToken(noToken).balanceOf(user);
        
        return yesBalance > 0 || noBalance > 0;
    }

    /**
     * @dev Internal helper to get position details (external for try/catch)
     * @param marketId The market ID
     * @param user The user address
     * @return position UserPosition struct with balance and investment details
     */
    function _getPosition(uint256 marketId, address user) 
        external 
        view 
        returns (UserPosition memory position) 
    {
        (, , , , , , address yesToken, address noToken, , , , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 yesBalance = IOutcomeToken(yesToken).balanceOf(user);
        uint256 noBalance = IOutcomeToken(noToken).balanceOf(user);
        (uint256 bnbInvested, ) = predictionMarket.userInvestments(marketId, user);
        
        return UserPosition({
            marketId: marketId,
            yesBalance: yesBalance,
            noBalance: noBalance,
            totalInvested: yesBalance + noBalance,
            bnbInvested: bnbInvested
        });
    }

    // ==================== MULTIPLIER CALCULATIONS ====================

    /**
     * @notice Calculate multiplier and output for buying YES tokens with BNB
     * @param marketId The market ID
     * @param bnbAmount Amount of BNB to spend
     * @return multiplier The effective multiplier (scaled by 10000)
     * @return totalOut Total YES tokens received
     * @return totalFee Total fees paid
     */
    function getBuyYesMultiplier(uint256 marketId, uint256 bnbAmount) 
        external 
        view 
        returns (uint256 multiplier, uint256 totalOut, uint256 totalFee) 
    {
        require(bnbAmount > 0, "Zero amount");
        
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint32 feeBps = predictionMarket.feeBps();
        
        // Calculate fees
        uint256 platformFee = (bnbAmount * feeBps) / 10000;
        uint256 amountAfterFee = bnbAmount - platformFee;
        
        // Calculate swap output
        uint256 swapOut = _getAmountOut(amountAfterFee, noPool, yesPool);
        
        // Total YES tokens = direct mint + swap output
        totalOut = bnbAmount + swapOut;
        totalFee = platformFee;
        
        // Multiplier = (total tokens received / BNB spent) * 10000
        multiplier = (totalOut * 10000) / bnbAmount;
        
        return (multiplier, totalOut, totalFee);
    }

    /**
     * @notice Calculate multiplier and output for buying NO tokens with BNB
     * @param marketId The market ID
     * @param bnbAmount Amount of BNB to spend
     * @return multiplier The effective multiplier (scaled by 10000)
     * @return totalOut Total NO tokens received
     * @return totalFee Total fees paid
     */
    function getBuyNoMultiplier(uint256 marketId, uint256 bnbAmount) 
        external 
        view 
        returns (uint256 multiplier, uint256 totalOut, uint256 totalFee) 
    {
        require(bnbAmount > 0, "Zero amount");
        
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint32 feeBps = predictionMarket.feeBps();
        
        // Calculate fees
        uint256 platformFee = (bnbAmount * feeBps) / 10000;
        uint256 amountAfterFee = bnbAmount - platformFee;
        
        // Calculate swap output
        uint256 swapOut = _getAmountOut(amountAfterFee, yesPool, noPool);
        
        // Total NO tokens = direct mint + swap output
        totalOut = bnbAmount + swapOut;
        totalFee = platformFee;
        
        // Multiplier = (total tokens received / BNB spent) * 10000
        multiplier = (totalOut * 10000) / bnbAmount;
        
        return (multiplier, totalOut, totalFee);
    }

    /**
     * @notice Calculate multiplier for swapping between YES and NO tokens
     * @param marketId The market ID
     * @param amountIn Amount of tokens to swap
     * @param isYesIn True if swapping YES for NO, false for NO to YES
     * @return multiplier The swap multiplier (scaled by 10000)
     * @return amountOut Tokens received from swap
     * @return fee Fee paid
     */
    function getSwapMultiplier(uint256 marketId, uint256 amountIn, bool isYesIn) 
        external 
        view 
        returns (uint256 multiplier, uint256 amountOut, uint256 fee) 
    {
        require(amountIn > 0, "Zero amount");
        
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint32 feeBps = predictionMarket.feeBps();
        
        // Calculate fees
        uint256 platformFee = (amountIn * feeBps) / 10000;
        uint256 amountAfterFee = amountIn - platformFee;
        
        // Calculate swap output
        if (isYesIn) {
            amountOut = _getAmountOut(amountAfterFee, yesPool, noPool);
        } else {
            amountOut = _getAmountOut(amountAfterFee, noPool, yesPool);
        }
        
        fee = platformFee;
        
        // Multiplier = (tokens received / tokens spent) * 10000
        multiplier = (amountOut * 10000) / amountIn;
        
        return (multiplier, amountOut, fee);
    }

    // ==================== PRICE & TRADING INFO ====================

    /**
     * @notice Get current YES token price as percentage (0-10000 basis points)
     * @param marketId The market ID
     * @return price YES price in basis points (e.g., 6500 = 65%)
     */
    function getYesPrice(uint256 marketId) 
        external 
        view 
        returns (uint256 price) 
    {
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 totalPool = yesPool + noPool;
        if (totalPool == 0) return 5000; // 50% default
        
        return (yesPool * 10000) / totalPool;
    }

    /**
     * @notice Get current NO token price as percentage (0-10000 basis points)
     * @param marketId The market ID
     * @return price NO price in basis points (e.g., 3500 = 35%)
     */
    function getNoPrice(uint256 marketId) 
        external 
        view 
        returns (uint256 price) 
    {
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 totalPool = yesPool + noPool;
        if (totalPool == 0) return 5000; // 50% default
        
        return (noPool * 10000) / totalPool;
    }

    /**
     * @notice Get comprehensive trading information for a market
     * @param marketId The market ID
     * @return info TradingInfo struct with multipliers, prices, and liquidity
     */
    function getTradingInfo(uint256 marketId) 
        external 
        view 
        returns (TradingInfo memory info) 
    {
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 totalPool = yesPool + noPool;
        
        if (totalPool == 0) {
            return TradingInfo({
                yesMultiplier: 10000,
                noMultiplier: 10000,
                yesPrice: 5000,
                noPrice: 5000,
                totalLiquidity: 0
            });
        }
        
        uint256 yesPrice = (yesPool * 10000) / totalPool;
        uint256 noPrice = (noPool * 10000) / totalPool;
        
        // Multiplier = 1 / price (scaled by 1e6 for precision, then normalized to 10000)
        uint256 yesMultiplier = yesPrice > 0 ? (1e10) / yesPrice : type(uint256).max;
        uint256 noMultiplier = noPrice > 0 ? (1e10) / noPrice : type(uint256).max;
        
        return TradingInfo({
            yesMultiplier: yesMultiplier,
            noMultiplier: noMultiplier,
            yesPrice: yesPrice,
            noPrice: noPrice,
            totalLiquidity: totalPool
        });
    }

    /**
     * @notice Get current multipliers for both sides (matches main contract function)
     * @param marketId The market ID
     * @return yesMultiplier YES multiplier (scaled by 10000)
     * @return noMultiplier NO multiplier (scaled by 10000)
     * @return yesPrice YES price in basis points
     * @return noPrice NO price in basis points
     */
    function getCurrentMultipliers(uint256 marketId) 
        external 
        view 
        returns (
            uint256 yesMultiplier, 
            uint256 noMultiplier, 
            uint256 yesPrice, 
            uint256 noPrice
        ) 
    {
        (, , , , , , , , uint256 yesPoolVal, uint256 noPoolVal, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 totalPool = yesPoolVal + noPoolVal;
        
        if (totalPool == 0) {
            return (10000, 10000, 5000, 5000);
        }
        
        yesPrice = (yesPoolVal * 10000) / totalPool;
        noPrice = (noPoolVal * 10000) / totalPool;
        
        yesMultiplier = yesPrice > 0 ? (1e10) / yesPrice : type(uint256).max;
        noMultiplier = noPrice > 0 ? (1e10) / noPrice : type(uint256).max;
        
        return (yesMultiplier, noMultiplier, yesPrice, noPrice);
    }

    // ==================== RESOLUTION STATUS CHECKS ====================

    /**
     * @notice Check if a market can request resolution
     * @param marketId The market ID
     * @return canRequest True if resolution can be requested
     */
    function canRequestResolution(uint256 marketId) 
        external 
        view 
        returns (bool canRequest) 
    {
        (, , , uint256 endTime, uint8 status, , , , , , , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        // Can request if market is Open and past end time
        return status == uint8(MarketStatus.Open) && block.timestamp >= endTime;
    }

    /**
     * @notice Check if a market can be disputed
     * @param marketId The market ID
     * @return canDisputeMarket True if market can be disputed
     */
    function canDispute(uint256 marketId) 
        external 
        view 
        returns (bool canDisputeMarket) 
    {
        (, , , , uint8 status, , , , , , , , , , , , , uint256 disputeDeadline, , ) = 
            predictionMarket.markets(marketId);
        
        // Can dispute if in ResolutionRequested status and within dispute period
        return status == uint8(MarketStatus.ResolutionRequested) && 
               block.timestamp <= disputeDeadline;
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * @dev Calculate output amount for constant product AMM
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function _getAmountOut(
        uint256 amountIn, 
        uint256 reserveIn, 
        uint256 reserveOut
    ) 
        internal 
        pure 
        returns (uint256 amountOut) 
    {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid amounts");
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /**
     * @notice Batch get market investments for multiple users
     * @param marketId The market ID
     * @param users Array of user addresses
     * @return investments Array of investment amounts
     */
    function batchGetMarketInvestments(uint256 marketId, address[] calldata users) 
        external 
        view 
        returns (uint256[] memory investments) 
    {
        investments = new uint256[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            (uint256 invested, ) = predictionMarket.userInvestments(marketId, users[i]);
            investments[i] = invested;
        }
        
        return investments;
    }

    /**
     * @notice Batch get trading info for multiple markets
     * @param marketIds Array of market IDs
     * @return infos Array of TradingInfo structs
     */
    function batchGetTradingInfo(uint256[] calldata marketIds) 
        external 
        view 
        returns (TradingInfo[] memory infos) 
    {
        infos = new TradingInfo[](marketIds.length);
        
        for (uint256 i = 0; i < marketIds.length; i++) {
            try this._getTradingInfoSafe(marketIds[i]) returns (TradingInfo memory info) {
                infos[i] = info;
            } catch {
                // Return default values if market doesn't exist
                infos[i] = TradingInfo({
                    yesMultiplier: 10000,
                    noMultiplier: 10000,
                    yesPrice: 5000,
                    noPrice: 5000,
                    totalLiquidity: 0
                });
            }
        }
        
        return infos;
    }

    /**
     * @dev Safe wrapper for getting trading info (external for try/catch)
     * @param marketId The market ID
     * @return info TradingInfo struct with market data
     */
    function _getTradingInfoSafe(uint256 marketId) 
        external 
        view 
        returns (TradingInfo memory info) 
    {
        (, , , , , , , , uint256 yesPool, uint256 noPool, , , , , , , , , , ) = 
            predictionMarket.markets(marketId);
        
        uint256 totalPool = yesPool + noPool;
        
        if (totalPool == 0) {
            return TradingInfo({
                yesMultiplier: 10000,
                noMultiplier: 10000,
                yesPrice: 5000,
                noPrice: 5000,
                totalLiquidity: 0
            });
        }
        
        uint256 yesPrice = (yesPool * 10000) / totalPool;
        uint256 noPrice = (noPool * 10000) / totalPool;
        
        uint256 yesMultiplier = yesPrice > 0 ? (1e10) / yesPrice : type(uint256).max;
        uint256 noMultiplier = noPrice > 0 ? (1e10) / noPrice : type(uint256).max;
        
        return TradingInfo({
            yesMultiplier: yesMultiplier,
            noMultiplier: noMultiplier,
            yesPrice: yesPrice,
            noPrice: noPrice,
            totalLiquidity: totalPool
        });
    }
}