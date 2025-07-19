// scripts/deployAF.js
const hre = require("hardhat");
const { entryPointAddress } = require('../addressConfig');
const { updateConfig } = require('./helpers/updateConfig');

async function main() {
  // Deploy AccountFactory contract với entryPointAddress là constructor param
  const AccountFactory = await hre.ethers.deployContract("AccountFactory", [entryPointAddress]);
  await AccountFactory.waitForDeployment();

  // Lấy địa chỉ contract mới deploy
  const factoryAddress = AccountFactory.target;
  console.log(`✅ AccountFactory deployed to: ${factoryAddress}`);

  // Cập nhật lại config (tự động ghi lại địa chỉ mới vào file addressConfig.js hoặc .json)
  updateConfig('accountFactoryAddress', factoryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
