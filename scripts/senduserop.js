const hre = require("hardhat");
const { ethers } = hre;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { 
  eoaPublicKey, 
  eoaPrivateKey, 
  simpleAccountAddress, 
  entryPointAddress, 
  tokenAddress, 
  accountFactoryAddress, 
  paymasterAddress 
} = require('../addressConfig');

async function main() {
  if (!process.env.INFURA_KEY) throw new Error("Missing INFURA_KEY in .env file!");

  const provider = new hre.ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`);
  const wallet = new hre.ethers.Wallet(eoaPrivateKey, provider);

  // Contract instances
  const entryPoint = await hre.ethers.getContractAt("EntryPoint", entryPointAddress, wallet);
  const simpleAccount = await hre.ethers.getContractAt("SimpleAccount", simpleAccountAddress, wallet);
  const accountFactory = await hre.ethers.getContractAt("AccountFactory", accountFactoryAddress, wallet);
  const tokenContract = await hre.ethers.getContractAt("Token", tokenAddress, wallet);

  // Show EOA's ETH balance
  const balanceWei = await provider.getBalance(wallet.address);
  console.log(`Signer ETH balance: ${balanceWei} Wei`);

  // Check if SimpleAccount is deployed
  const code = await provider.getCode(simpleAccountAddress);
  let initCode;
  if (code === '0x') {
    initCode = accountFactoryAddress + accountFactory.interface.encodeFunctionData('createAccount', [eoaPublicKey, 0]).slice(2);
    console.log(`SimpleAccount is not yet deployed. Will use initCode: ${initCode}`);
  } else {
    initCode = '0x';
    console.log(`SimpleAccount is already deployed.`);
  }

  // Approve calldata
  const spender = "0xd2Db07eC45D7E83D4Cc4C4da7e528C4374D64029";
  const amount = ethers.parseUnits("10", 18);
  const funcTargetData = tokenContract.interface.encodeFunctionData('approve', [spender, amount]);
  const data = simpleAccount.interface.encodeFunctionData('execute', [tokenAddress, 0, funcTargetData]);
  console.log(`Encoded callData: ${data}`);

  // Read userOp config from file
  const userOpPath = path.join(__dirname, '..', 'GA', 'GA','userOp.json');
  const userOpData = JSON.parse(fs.readFileSync(userOpPath, 'utf8'));

  // Build userOp object
  const nonce = await entryPoint.getNonce(simpleAccountAddress, 0);




  const userOp = {
    sender: simpleAccountAddress,
    nonce,
    initCode,
    callData: data,
    callGasLimit: ethers.toBigInt(userOpData.callGasLimit),
    verificationGasLimit: ethers.toBigInt(userOpData.verificationGasLimit),
    preVerificationGas: ethers.toBigInt(userOpData.preVerificationGas),
    maxFeePerGas: ethers.parseUnits(userOpData.maxFeePerGas.toString(), "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits(userOpData.maxPriorityFeePerGas.toString(), "gwei"),
    paymasterAndData: paymasterAddress,
    signature: '0x'
  };
  console.log('UserOp (pre-sign):', userOp);

  // Sign userOp
  const hash = await entryPoint.getUserOpHash(userOp);
  userOp.signature = await wallet.signMessage(ethers.getBytes(hash));
  console.log('Signed signature:', userOp.signature);

  // Encode handleOps data
  const encodedData = entryPoint.interface.encodeFunctionData("handleOps", [[userOp], eoaPublicKey]);
  console.log('Encoded handleOps data:', encodedData);

  // Estimate gas
  let gasLimit = 2000000;
  try {
    const gasEstimate = await entryPoint.estimateGas.handleOps([userOp], eoaPublicKey);
    gasLimit = Math.floor(Number(gasEstimate) * 1.2);
    console.log(`Estimated gas limit: ${gasLimit}`);
  } catch (gasError) {
    console.warn('Gas estimation failed, using default gasLimit:', gasLimit);
  }

  // Send tx
  try {
    const tx = await wallet.sendTransaction({
      to: entryPointAddress,
      data: encodedData,
      gasLimit: gasLimit
    });
    const receipt = await tx.wait();
    console.log('Transaction successful! Hash:', receipt.transactionHash);
    console.log(`View on Sepolia Etherscan: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
  } catch (error) {
    console.error('Error sending transaction:', error);
    if (error.revert) {
      console.error('Revert reason:', error.revert);
    }
  }
}

main().catch((error) => {
  console.error('Main function error:', error);
  process.exitCode = 1;
});
