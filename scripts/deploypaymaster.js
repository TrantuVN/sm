const hre = require("hardhat");
const { entryPointAddress, accountFactoryAddress } = require("../addressConfig");
const { updateConfig } = require("./helpers/updateConfig");

async function main() {
  const pm = await hre.ethers.deployContract("Paymaster", [
    accountFactoryAddress,
    entryPointAddress,
  ]);
  await pm.waitForDeployment();
  console.log(`PM deployed to ${pm.target}`);
  updateConfig("paymasterAddress", pm.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});