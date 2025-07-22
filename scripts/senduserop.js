const hre = require("hardhat");
const { priorityFeePerGas } = require('./helpers/gasEstimator');
const { eoaPublicKey, 
        eoaPrivateKey, 
        simpleAccountAddress, 
        entryPointAddress, 
        tokenAddress, 
        accountFactoryAddress, 
        paymasterAddress } = require('../addressConfig');

async function main() {
    const ethers = hre.ethers;
    const wallet = new ethers.Wallet(eoaPrivateKey);
    const signer = wallet.connect(hre.ethers.provider);

    const AccountFactory = await hre.ethers.getContractAt("AccountFactory", accountFactoryAddress, signer);
    const entryPoint = await hre.ethers.getContractAt("EntryPoint", entryPointAddress, signer);
    const simpleAccount = await hre.ethers.getContractAt("SimpleAccount", simpleAccountAddress, signer);
    const Token = await hre.ethers.getContractAt("Token", tokenAddress, signer);

    const balanceWei = await hre.ethers.provider.getBalance(signer.address);
    console.log(`The balance of the signer is: ${balanceWei} Wei`);

    // Deposit to EntryPoint if needed, using available balance
    
    const deposit = await entryPoint.balanceOf(simpleAccountAddress);
    if (deposit === 0n) {
        const depositAmount = ethers.parseEther("0.004"); // Reduced to 0.004 ETH
        const tx = await entryPoint.depositTo(simpleAccountAddress, { value: depositAmount });
        await tx.wait();
        console.log("Deposited 0.004 ETH to EntryPoint for SimpleAccount");
    }

    // Check and transfer ownership if needed
    const currentOwner = await Token.owner();
    if (currentOwner.toLowerCase() !== simpleAccountAddress.toLowerCase()) {
        if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.warn(`Warning: Signer ${wallet.address} is not Token owner (${currentOwner}). Ownership transfer skipped. Mint may fail.`);
        } else {
            console.log(`Transferring ownership from ${currentOwner} to ${simpleAccountAddress}`);
            const tx = await Token.transferOwnership(simpleAccountAddress);
            await tx.wait();
            console.log("Ownership transferred successfully");
        }
    }

    const mintAmount = ethers.parseUnits("100", 18);
    const receiver = simpleAccountAddress;
    const funcTargetData = Token.interface.encodeFunctionData('safeMint', [receiver, mintAmount]);

    const data = simpleAccount.interface.encodeFunctionData('execute', [tokenAddress, 0, funcTargetData]);

    let initCode = accountFactoryAddress + AccountFactory.interface.encodeFunctionData('createAccount', [eoaPublicKey, 0]).slice(2);

    const code = await hre.ethers.provider.getCode(simpleAccountAddress);

    if (code !== '0x') {
        initCode = '0x'
    }

    console.log('maxPriorityFeePerGas:', await priorityFeePerGas());

// Make sure all gas parameters are BigInt, and convert Gwei (float from JSON) to Wei
const userOp = {
  sender: simpleAccountAddress,
  nonce: await entryPoint.getNonce(simpleAccountAddress, 0),
  initCode: initCode,
  callData: data,
  callGasLimit: '100000',
  verificationGasLimit: '1000000',
  preVerificationGas: '0x129eb',
  maxFeePerGas: '0x6333efe',
  maxPriorityFeePerGas: await priorityFeePerGas(),
  paymasterAndData: '0x',
  signature: '0x'

};

    const hash = await entryPoint.getUserOpHash(userOp);

    userOp.signature = await signer.signMessage(hre.ethers.getBytes(hash));

    try {
        const tx = await entryPoint.handleOps([userOp], eoaPublicKey, {
            gasLimit: 2000000
        });
        const receipt = await tx.wait();
        console.log('Transaction successful:', receipt);
    } catch (error) {
        console.error('Error sending transaction:', error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});