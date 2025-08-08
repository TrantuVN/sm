const hre = require("hardhat");
const { createGasEstimator } = require("@biconomy/gas-estimations");
const { http, createPublicClient } = require("viem");
const { sepolia } = require("viem/chains");

const {
  eoaPublicKey,
  eoaPrivateKey,
  simpleAccountAddress,
  entryPointAddress,
  tokenAddress,
  accountFactoryAddress,
  paymasterAddress
} = require("../addressConfig");

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

  const deposit = await entryPoint.balanceOf(simpleAccountAddress);
  if (deposit === 0n) {
    const depositAmount = ethers.parseEther("0.004");
    const tx = await entryPoint.depositTo(simpleAccountAddress, { value: depositAmount });
    await tx.wait();
    console.log("Deposited 0.004 ETH to EntryPoint for SimpleAccount");
  }

  const currentOwner = await Token.owner();
  if (currentOwner.toLowerCase() !== simpleAccountAddress.toLowerCase()) {
    if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.warn(`Warning: Signer ${wallet.address} is not Token owner (${currentOwner}). Ownership transfer skipped.`);
    } else {
      const tx = await Token.transferOwnership(simpleAccountAddress);
      await tx.wait();
      console.log("Ownership transferred successfully");
    }
  }

  const mintAmount = ethers.parseUnits("100", 18);
  const receiver = simpleAccountAddress;
  const funcTargetData = Token.interface.encodeFunctionData("safeMint", [receiver, mintAmount]);
  const callData = simpleAccount.interface.encodeFunctionData("execute", [tokenAddress, 0, funcTargetData]);

  let initCode = accountFactoryAddress +
    AccountFactory.interface.encodeFunctionData("createAccount", [eoaPublicKey, 0]).slice(2);

  const code = await hre.ethers.provider.getCode(simpleAccountAddress);
  if (code !== "0x") {
    initCode = "0x";
  }

  const viemClient = createPublicClient({
    chain: sepolia,
    transport: http("https://sepolia.infura.io/v3/f8e36a290fbd4d278590f4ca3d5c66f1") 
  });

  const gasEstimator = createGasEstimator({
    chainId: sepolia.id,
    rpc: viemClient
  });

  // Lấy dữ liệu gas
  const feeData = await hre.ethers.provider.getFeeData();
  const baseFeePerGasRaw = feeData.lastBaseFeePerGas ?? feeData.gasPrice;
  const maxPriorityFeePerGasRaw = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei");

  const baseFeePerGas = BigInt(baseFeePerGasRaw.toString());
  const maxPriorityFeePerGas = BigInt(maxPriorityFeePerGasRaw.toString());
  const maxFeePerGas = baseFeePerGas + maxPriorityFeePerGas * 2n;

  // Tạo userOp để ký
  const unsignedUserOp = {
    sender: simpleAccountAddress,
    nonce: await entryPoint.getNonce(simpleAccountAddress, 0),
    initCode,
    callData,
    paymasterAndData: "0x",
    maxFeePerGas,
    maxPriorityFeePerGas,
    preVerificationGas: 100000n,        // temporary
    callGasLimit: 100000n,              // temporary
    verificationGasLimit: 100000n,      // temporary
    signature: "0x"
  };

  // Ký thật userOp để simulate hợp lệ
  const userOpHash = await entryPoint.getUserOpHash(unsignedUserOp);
  unsignedUserOp.signature = await signer.signMessage(hre.ethers.getBytes(userOpHash));

  // Estimate gas với signature thật
  const gasEstimate = await gasEstimator.estimateUserOperationGas({
    unEstimatedUserOperation: unsignedUserOp,
    baseFeePerGas
  });

  const fullUserOp = {
    ...unsignedUserOp,
    ...gasEstimate
  };

  // Ký lại với thông tin gas đầy đủ
  const finalHash = await entryPoint.getUserOpHash(fullUserOp);
  fullUserOp.signature = await signer.signMessage(hre.ethers.getBytes(finalHash));

  // Gửi giao dịch
  try {
    const tx = await entryPoint.handleOps([fullUserOp], eoaPublicKey, {
      gasLimit: 2000000
    });
    const receipt = await tx.wait();
    console.log("Transaction successful:", receipt);
  } catch (error) {
    console.error("Error sending transaction:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
