import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDC_AMOY = "0x8B0180f2101c8260d49339abfEe87927412494B4";
const WETH_AMOY = "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E";

const AMMAmoyModule = buildModule("AMMAmoyModule", (m) => {
  const amm = m.contract("AMM");
  m.call(amm, "setPoolTokens", [USDC_AMOY, WETH_AMOY]);

  return {
    amm,
  };
});

export default AMMAmoyModule;
