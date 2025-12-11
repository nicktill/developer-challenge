import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  defaultNetwork: "firefly",
  networks: {
    firefly: {
      url: "http://127.0.0.1:5100",
      accounts: [
        "0xfb5a6475c4c3233d78576d4b346971e011caa29063e5792d407866d515b0cdf9", // Member 0
        "0x8920c781ba0d8227616aea46257351137e2d5d4d80c6825aa6814ed2a3a0ffe9"  // Member 1
      ]
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;