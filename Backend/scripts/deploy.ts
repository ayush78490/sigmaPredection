import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BNB`);

  // Deploy the contract
  console.log("Deploying PredictionMarketFactory...");
  
  const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarketFactory");
  const factory = await PredictionMarketFactory.deploy(30, 5000); // feeBps: 0.3%, lpFeeBps: 50%

  // Wait for deployment
  await factory.waitForDeployment();
  const contractAddress = await factory.getAddress();

  console.log("✅ PredictionMarketFactory deployed to:", contractAddress);
  console.log("📝 Transaction hash:", factory.deploymentTransaction()?.hash);

  // Wait for a few confirmations
  console.log("Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  console.log("\n=== Deployment Complete ===");
  console.log("Contract address:", contractAddress);
  console.log("Deployer:", deployer.address);
  
  console.log("\n🔍 To verify on BscScan, run:");
  console.log(`npx hardhat verify --network bnbTestnet ${contractAddress} 30 5000`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});