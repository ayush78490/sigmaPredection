// scripts/extractABI.ts
import fs from "fs";
import path from "path";

const extractABI = (): void => {
  try {
    // Path to your contract artifact
    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Bazar.sol", "PredictionMarketFactory.json");
    
    if (!fs.existsSync(artifactPath)) {
      console.log("❌ Contract artifact not found. Please compile first:");
      console.log("   npx hardhat compile");
      return;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;
    
    // Save ABI to file
    const abiPath = path.join(__dirname, "..", "abi.json");
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    
    console.log("✅ ABI extracted successfully!");
    console.log(`📁 Saved to: ${abiPath}`);
    console.log(`📊 ABI has ${abi.length} items`);
    
    // Show some ABI info with simple typing
    const functions = abi.filter((item: any) => item.type === "function");
    const events = abi.filter((item: any) => item.type === "event");
    
    console.log(`🔧 Functions: ${functions.length}`);
    console.log(`📢 Events: ${events.length}`);
    
  } catch (error) {
    console.error("❌ Error extracting ABI:", error);
  }
};

extractABI();