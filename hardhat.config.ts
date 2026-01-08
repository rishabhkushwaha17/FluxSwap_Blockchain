import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

const privateKey = configVariable("PRIVATE_KEY");

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    polygon_amoy: {
      type:"http",
      url: "https://api.zan.top/polygon-amoy",
      accounts: [privateKey],
      gasPrice: 10000000,
    }
  },
  verify:{
   etherscan: {
    apiKey: configVariable("ETHERSCAN_API_KEY"),
    enabled:true,
    },
  }
};

export default config;
