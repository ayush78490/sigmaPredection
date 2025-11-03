import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const { PRIVATE_KEY, RPC_URL } = process.env;

// loosen the networks typing to avoid the strict union mismatch with Hardhat's types
const networks: Record<string, any> = {
  hardhat: {},
  bnbTestnet: {
    url: RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    chainId: 97,
  },
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks,
};

export default config;