import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BNB`);

  // Get PDX token address from .env
  const pdxTokenAddress = process.env.PDX_TOKEN_ADDRESS;

  if (!pdxTokenAddress) {
    throw new Error("❌ PDX_TOKEN_ADDRESS not set in .env file");
  }

  if (!ethers.isAddress(pdxTokenAddress)) {
    throw new Error("❌ Invalid PDX token address");
  }

  console.log(`\nUsing PDX Token: ${pdxTokenAddress}`);

  // The contract name
  const contractName = "PredictionMarketPDX";

  console.log(`\nDeploying ${contractName}...`);

  try {
    const ContractFactory = await ethers.getContractFactory(contractName);

    // Constructor parameters: pdxToken, feeBps (0.3% = 30), lpFeeBps (50% = 5000), resolutionServer
    const pdxToken = pdxTokenAddress;
    const feeBps = 30; // 0.3%
    const lpFeeBps = 5000; // 50% of fees go to LPs
    const resolutionServer = deployer.address; // Use deployer as resolution server

    console.log(`Constructor parameters:`);
    console.log(`  PDX Token: ${pdxToken}`);
    console.log(`  Fee BPS: ${feeBps} (0.3%)`);
    console.log(`  LP Fee BPS: ${lpFeeBps} (50%)`);
    console.log(`  Resolution Server: ${resolutionServer}`);

    const contract = await ContractFactory.deploy(
      pdxToken,
      feeBps,
      lpFeeBps,
      resolutionServer
    );

    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log(`\n✅ ${contractName} deployed to:`, contractAddress);
    console.log("📝 Transaction hash:", contract.deploymentTransaction()?.hash);

    // Wait for a few confirmations
    console.log("\nWaiting for confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    console.log("\n=== Deployment Complete ===");
    console.log("Contract:", contractName);
    console.log("Address:", contractAddress);
    console.log("Deployer:", deployer.address);
    console.log("PDX Token:", pdxToken);
    console.log("Fee (bps):", feeBps);
    console.log("LP Fee Share (bps):", lpFeeBps);
    console.log("Resolution Server:", resolutionServer);

    console.log("\n🔍 To verify on BscScan, run:");
    console.log(
      `npx hardhat verify --network bsc_testnet ${contractAddress} ${pdxToken} ${feeBps} ${lpFeeBps} ${resolutionServer}`
    );

    console.log("\n💾 Environment Variables:");
    console.log(`VITE_PREDICTION_MARKET_ADDRESS=${contractAddress}`);
    console.log(`VITE_PDX_TOKEN_ADDRESS=${pdxToken}`);
    console.log(`VITE_CHAIN_ID=97`);
  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message);

    // If the exact name fails, try variations
    console.log("\nTrying alternative contract names...");
    await tryAlternativeNames(deployer.address, pdxTokenAddress);
  }
}

async function tryAlternativeNames(
  deployer: string,
  pdxToken: string
): Promise<void> {
  const alternatives = [
    "PredictionMarketWithMultipliers",
    "PredictionMarket",
    "Bazar",
    "Market",
  ];

  for (const name of alternatives) {
    try {
      console.log(`Trying ${name}...`);
      const ContractFactory = await ethers.getContractFactory(name);
      const contract = await ContractFactory.deploy(pdxToken, 30, 5000, deployer);

      await contract.waitForDeployment();
      const address = await contract.getAddress();

      console.log(`✅ Success! ${name} deployed to:`, address);
      console.log("📝 Transaction hash:", contract.deploymentTransaction()?.hash);

      console.log("\n🔍 To verify on BscScan, run:");
      console.log(
        `npx hardhat verify --network bsc_testnet ${address} ${pdxToken} 30 5000 ${deployer}`
      );

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
  console.log(
    "1. The contract name matches 'PredictionMarketWithMultipliers'"
  );
  console.log("2. The contract compiles successfully");
  console.log(
    "3. PDX_TOKEN_ADDRESS is set in .env"
  );
  console.log("4. You're using the correct constructor parameters");
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exitCode = 1;
});