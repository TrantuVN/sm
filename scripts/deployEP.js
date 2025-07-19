const hre = require("hardhat");
const { updateConfig } = require('./helpers/updateConfig');
async function main() {
    const entryPoint = await hre.ethers.deployContract("EntryPoint");
    await entryPoint.waitForDeployment();
    console.log(`EP deployed to ${entryPoint.target}`);
    updateConfig('entryPointAddress', entryPoint.target);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});