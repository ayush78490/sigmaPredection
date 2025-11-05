// lib/web3/config.ts
export const PREDICTION_MARKET_ADDRESS = "0x52Ca4B7673646B8b922ea00ccef6DD0375B14619";

export const PREDICTION_MARKET_ABI = [
  // Market Creation
  "function createMarket(string calldata question, uint256 endTime, uint256 initialYes, uint256 initialNo) external payable returns (uint256)",
  
  // Complete Sets
  "function mintCompleteSets(uint256 id, uint256 amount) external payable",
  "function burnCompleteSets(uint256 id, uint256 amount) external",
  
  // Trading
  "function swapYesForNo(uint256 id, uint256 yesIn, uint256 minNoOut) external",
  "function swapNoForYes(uint256 id, uint256 noIn, uint256 minYesOut) external",
  
  // Liquidity
  "function addLiquidity(uint256 id, uint256 yesAmount, uint256 noAmount, uint256 minLPTokens) external returns (uint256)",
  "function removeLiquidity(uint256 id, uint256 lpTokens, uint256 minYes, uint256 minNo) external returns (uint256, uint256)",
  
  // Resolution
  "function closeMarket(uint256 id) external",
  "function proposeOutcome(uint256 id, uint8 outcome) external payable",
  "function disputeProposal(uint256 id) external payable",
  "function oracleVote(uint256 id, uint8 outcome) external",
  "function finalizeProposal(uint256 id) external",
  "function redeem(uint256 id) external",
  
  // Views
  "function getMarket(uint256 id) external view returns (address creator, string memory question, uint256 endTime, uint8 status, uint8 outcome, address yesToken, address noToken, uint256 yesPool, uint256 noPool, uint256 lpTotalSupply, uint256 totalBacking)",
  "function getPrice(uint256 id) external view returns (uint256 yesPrice, uint256 noPrice)",
  "function getAmountOut(uint256 id, uint256 amountIn, bool yesIn) external view returns (uint256 amountOut, uint256 fee)",
  "function getLPBalance(uint256 id, address user) external view returns (uint256)",
  "function getProposalInfo(uint256 id) external view returns (address proposer, uint8 proposedOutcome, uint256 proposalTime, uint256 proposalBond, address disputer, uint256 disputeBond)",
  "function getOracleVotes(uint256 id) external view returns (uint256 yesVotes, uint256 noVotes, uint256 invalidVotes)",
  
  // State Variables
  "function nextMarketId() external view returns (uint256)",
  "function feeBps() external view returns (uint32)",
  "function lpFeeBps() external view returns (uint32)",
  "function owner() external view returns (address)",
  
  // Events
  "event MarketCreated(uint256 indexed id, string question, address yesToken, address noToken, uint256 endTime)",
  "event Swap(uint256 indexed id, address indexed user, bool yesIn, uint256 amountIn, uint256 amountOut, uint256 fee)",
  "event CompleteSetMinted(uint256 indexed id, address indexed user, uint256 amount)",
  "event CompleteSetBurned(uint256 indexed id, address indexed user, uint256 amount)",
  "event LiquidityAdded(uint256 indexed id, address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 lpTokens)",
  "event LiquidityRemoved(uint256 indexed id, address indexed provider, uint256 yesAmount, uint256 noAmount, uint256 lpTokens)",
  "event Resolved(uint256 indexed id, uint8 outcome)",
  "event Redeemed(uint256 indexed id, address indexed user, uint256 amount, uint256 payout)"
] as const;

export const OUTCOME_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 value) external returns (bool)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)"
] as const;

// Enums matching the contract
export enum MarketStatus {
  Open = 0,
  Closed = 1,
  Proposed = 2,
  Disputed = 3,
  Resolved = 4
}

export enum Outcome {
  Undecided = 0,
  Yes = 1,
  No = 2,
  Invalid = 3
}

// Chain configuration (BSC Testnet)
export const CHAIN_CONFIG = {
  chainId: 97, // BSC Testnet
  chainName: "BSC Testnet",
  rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  blockExplorer: "https://testnet.bscscan.com",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18
  }
};