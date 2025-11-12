// scripts/extractAllABIs.ts
import fs from "fs";
import path from "path";

interface ContractConfig {
  name: string;
  artifactPath: string;
  outputName: string;
  displayName: string;
}

const contracts: ContractConfig[] = [
  {
    name: "PredictionMarketWithMultipliers",
    artifactPath: "contracts/Bazar.sol/PredictionMarketWithMultipliers.json",
    outputName: "abi.json",
    displayName: "Main PredictionMarket"
  },
  {
    name: "PredictionMarketHelper",
    artifactPath: "contracts/PredictionMarketHelper.sol/PredictionMarketHelper.json",
    outputName: "helper-abi.json",
    displayName: "Helper Contract"
  }
];

const extractABI = (config: ContractConfig): boolean => {
  try {
    const artifactPath = path.join(__dirname, "..", "artifacts", config.artifactPath);
    
    if (!fs.existsSync(artifactPath)) {
      console.log(`❌ ${config.displayName} artifact not found at:`);
      console.log(`   ${artifactPath}`);
      return false;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;
    
    // Save ABI to file
    const abiPath = path.join(__dirname, "..", config.outputName);
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    
    // Analyze ABI
    const functions = abi.filter((item: any) => item.type === "function");
    const views = functions.filter((item: any) => 
      item.stateMutability === "view" || item.stateMutability === "pure"
    );
    const writeOps = functions.filter((item: any) => 
      item.stateMutability !== "view" && item.stateMutability !== "pure"
    );
    const events = abi.filter((item: any) => item.type === "event");
    
    console.log(`✅ ${config.displayName}`);
    console.log(`   📁 Output: ${config.outputName}`);
    console.log(`   📊 Total Items: ${abi.length}`);
    console.log(`   👁️  View Functions: ${views.length}`);
    console.log(`   ✍️  Write Functions: ${writeOps.length}`);
    console.log(`   📢 Events: ${events.length}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error extracting ${config.displayName} ABI:`, error);
    return false;
  }
};

const extractAllABIs = (): void => {
  console.log("🔧 Extracting All Contract ABIs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Check if artifacts exist
  const artifactsDir = path.join(__dirname, "..", "artifacts");
  if (!fs.existsSync(artifactsDir)) {
    console.log("❌ Artifacts directory not found!");
    console.log("📝 Please compile your contracts first:");
    console.log("   npx hardhat compile\n");
    process.exit(1);
  }
  
  const results: boolean[] = [];
  
  // Extract each contract ABI
  contracts.forEach((config, index) => {
    const success = extractABI(config);
    results.push(success);
    
    if (index < contracts.length - 1) {
      console.log(); // Add spacing between contracts
    }
  });
  
  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    console.log(`✅ Successfully extracted ${successCount}/${totalCount} ABIs`);
    
    console.log("\n📦 Files created:");
    contracts.forEach(config => {
      console.log(`   - ${config.outputName}`);
    });
    
    console.log("\n💡 Import in your frontend:");
    console.log("   import MARKET_ABI from './abi.json'");
    console.log("   import HELPER_ABI from './helper-abi.json'");
    
    // Create combined export
    createCombinedExport();
    
  } else {
    console.log(`⚠️  Extracted ${successCount}/${totalCount} ABIs`);
    console.log("\n📝 Make sure all contracts are compiled:");
    console.log("   npx hardhat compile");
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
};

const createCombinedExport = (): void => {
  try {
    const marketAbiPath = path.join(__dirname, "..", "abi.json");
    const helperAbiPath = path.join(__dirname, "..", "helper-abi.json");
    
    if (!fs.existsSync(marketAbiPath) || !fs.existsSync(helperAbiPath)) {
      return;
    }
    
    const marketAbi = JSON.parse(fs.readFileSync(marketAbiPath, "utf8"));
    const helperAbi = JSON.parse(fs.readFileSync(helperAbiPath, "utf8"));
    
    const combined = {
      contracts: {
        PredictionMarket: {
          address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x9d8462A5A9CA9d4398069C67FEb378806fD10fAA",
          abi: marketAbi
        },
        PredictionMarketHelper: {
          address: process.env.NEXT_PUBLIC_HELPER_CONTRACT_ADDRESS || "DEPLOY_HELPER_FIRST",
          abi: helperAbi
        }
      },
      network: {
        chainId: 97,
        name: "BSC Testnet",
        rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
        blockExplorer: "https://testnet.bscscan.com"
      }
    };
    
    const combinedPath = path.join(__dirname, "..", "contracts.json");
    fs.writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
    
    console.log("\n📦 Combined contract export created:");
    console.log(`   ${combinedPath}`);
  } catch (error) {
    // Silent fail - combined export is optional
  }
};

extractAllABIs();