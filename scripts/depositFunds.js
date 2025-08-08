const hre = require("hardhat");
require('dotenv').config();

const { entryPointAddress, eoaPublicKey, paymasterAddress, simpleAccountAddress } = require('../addressConfig');

async function main() {
    // Create a wallet instance with the private key
    const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);

    // Connect the wallet to the Hardhat network provider
    const signer = wallet.connect(hre.ethers.provider);

    const entryPoint = await hre.ethers.getContractAt("EntryPoint", entryPointAddress, signer);

    // Deposit to SimpleAccount in EntryPoint
    const depositTx = await entryPoint.depositTo(simpleAccountAddress, {
        value: hre.ethers.parseEther("0.1"), // Use parseEther for ETH (e.g., 0.1 ETH)
    });
    const receipt1 = await depositTx.wait();
    console.log("Deposit to SimpleAccount:", receipt1);

    // Optional: Fund EOA if needed
    const tx = {
        to: eoaPublicKey,
        value: hre.ethers.parseEther("0.1"), // Adjust as needed
    };
    const transactionResponse = await signer.sendTransaction(tx);
    const receipt2 = await transactionResponse.wait();
    console.log("Fund EOA:", receipt2);

    console.log('Deposit successful');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});