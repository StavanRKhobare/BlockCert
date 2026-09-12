import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Required: Passport.submitEvent's parameter count overflows the EVM
      // stack without IR-based codegen ("stack too deep").
      viaIR: true,
    },
  },
};

export default config;
