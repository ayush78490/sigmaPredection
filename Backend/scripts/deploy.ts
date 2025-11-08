import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BNB`);

  // The contract name is "PredictionMarketWithMultipliers" based on your file
  const contractName = "PredictionMarketWithMultipliers";
  
  console.log(`Deploying ${contractName}...`);
  
  try {
    const ContractFactory = await ethers.getContractFactory(contractName);
    
    // Constructor parameters: feeBps (0.3% = 30), lpFeeBps (50% = 5000), resolutionServer
    const feeBps = 30; // 0.3%
    const lpFeeBps = 5000; // 50% of fees go to LPs
    const resolutionServer = deployer.address; // Use deployer as resolution server for now
    
    console.log(`Constructor parameters: feeBps=${feeBps}, lpFeeBps=${lpFeeBps}, resolutionServer=${resolutionServer}`);
    
    const contract = await ContractFactory.deploy(feeBps, lpFeeBps, resolutionServer);

    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log(`✅ ${contractName} deployed to:`, contractAddress);
    console.log("📝 Transaction hash:", contract.deploymentTransaction()?.hash);

    // Wait for a few confirmations
    console.log("Waiting for confirmations...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log("\n=== Deployment Complete ===");
    console.log("Contract:", contractName);
    console.log("Address:", contractAddress);
    console.log("Deployer:", deployer.address);
    console.log("Fee (bps):", feeBps);
    console.log("LP Fee Share (bps):", lpFeeBps);
    console.log("Resolution Server:", resolutionServer);
    
    console.log("\n🔍 To verify on BscScan, run:");
    console.log(`npx hardhat verify --network bnbTestnet ${contractAddress} ${feeBps} ${lpFeeBps} ${resolutionServer}`);
    
  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message);
    
    // If the exact name fails, try variations
    console.log("\nTrying alternative contract names...");
    await tryAlternativeNames(deployer.address);
  }
}

async function tryAlternativeNames(deployer: string) {
  const alternatives = [
    "PredictionMarketWithMultipliers",
    "PredictionMarket", 
    "Bazar",
    "Market"
  ];
  
  for (const name of alternatives) {
    try {
      console.log(`Trying ${name}...`);
      const ContractFactory = await ethers.getContractFactory(name);
      const contract = await ContractFactory.deploy(30, 5000, deployer);
      
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      
      console.log(`✅ Success! ${name} deployed to:`, address);
      console.log("📝 Transaction hash:", contract.deploymentTransaction()?.hash);
      
      console.log("\n🔍 To verify on BscScan, run:");
      console.log(`npx hardhat verify --network bnbTestnet ${address} 30 5000 ${deployer}`);
      
      return;
    } catch (error: any) {
      if (error.message.includes("Artifact for contract")) {
        console.log(`❌ ${name} not found`);
      } else {
        console.log(`❌ ${name} error:`, error.message);
      }
    }
  }
  
  console.log("\n❌ No contracts could be deployed.");
  console.log("Please make sure:");
  console.log("1. The contract name in Bazar.sol matches 'PredictionMarketWithMultipliers'");
  console.log("2. The contract compiles successfully");
  console.log("3. You're using the correct constructor parameters");
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exitCode = 1;
});