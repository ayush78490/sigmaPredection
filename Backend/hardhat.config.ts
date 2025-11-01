import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const { PRIVATE_KEY, RPC_URL } = process.env;

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    bnbTestnet: {
      url: RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 97,
    },
  },
};

export default config;