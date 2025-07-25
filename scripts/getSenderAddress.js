const hre = require("hardhat");

const { isAddress } = require("ethers");
const { accountFactoryAddress, entryPointAddress } = require('../addressConfig');
const { createEOA } = require('./helpers/createEOAwallet');
const {  updateConfig } = require('./helpers/updateConfig');   // EntryPoint address

async function main() {
  const AccountFactory = await hre.ethers.getContractAt("AccountFactory", accountFactoryAddress);
  const EOA = createEOA();
  const entryPoint = await hre.ethers.getContractAt("EntryPoint", entryPointAddress);

  const initCode = accountFactoryAddress + AccountFactory.interface.encodeFunctionData('createAccount', [EOA[0], 0]).slice(2);

 let simpleAccountAddress
  try {
    await entryPoint.getSenderAddress(initCode)
  } catch (transaction) {
    simpleAccountAddress = '0x' + transaction.data.slice(-40);
  }
  console.log('simpleAccountAddress:', simpleAccountAddress);
  updateConfig('eoaPublicKey', EOA[0]);
  updateConfig('eoaPrivateKey', EOA[1]);
  updateConfig('simpleAccountAddress', simpleAccountAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
