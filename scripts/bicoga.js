// optimizeGas.js (fix truy cập population đúng cách cho geneticalgorithm)
const hre = require("hardhat");
const { createGasEstimator } = require("@biconomy/gas-estimations");
const { http, createPublicClient } = require("viem");
const { sepolia } = require("viem/chains");
const fs = require("fs");
const path = require("path");
const GeneticAlgorithmConstructor = require("geneticalgorithm");
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const {
  entryPointAddress,
  eoaPrivateKey,
  eoaPublicKey,
  accountFactoryAddress,
  simpleAccountAddress,
  tokenAddress,
} = require("../addressConfig");

const config = {
  max_num_iteration: 5,
  population_size: 10,
  mutation_probability: 0.1,
  elit_ratio: 0.1,
  crossover_probability: 0.3,
  parents_portion: 0.3,
  crossover_type: "uniform",
  max_iteration_without_improv: 10
};

const bounds = {
  callGasLimit: { min: 200_000, max: 1_000_000 },
  verificationGasLimit: { min: 50_000, max: 500_000 },
  preVerificationGas: { min: 20_000, max: 200_000 }
};

async function runUserOpWithGasParams(call, verification, preverification) {
  const ethers = hre.ethers;
  const provider = ethers.provider;
  const wallet = new ethers.Wallet(eoaPrivateKey, provider);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  const gasEstimator = createGasEstimator({
    chainId: sepolia.id,
    rpc: publicClient,
});


  const AccountFactory = await hre.ethers.getContractAt("AccountFactory", accountFactoryAddress, wallet);
  const entryPoint = await hre.ethers.getContractAt("EntryPoint", entryPointAddress, wallet);
  const Token = await hre.ethers.getContractAt("Token", tokenAddress, wallet);
  const simpleAccount = await hre.ethers.getContractAt("SimpleAccount", simpleAccountAddress, wallet);

  const feeData = await provider.getFeeData();
  const callData = simpleAccount.interface.encodeFunctionData("execute", [
    tokenAddress,
    0,
    Token.interface.encodeFunctionData("safeMint", [simpleAccountAddress, ethers.parseUnits("100", 18)]),
  ]);

  const initCode = (await provider.getCode(simpleAccountAddress)) === "0x"
    ? accountFactoryAddress + AccountFactory.interface.encodeFunctionData("createAccount", [eoaPublicKey, 0]).slice(2)
    : "0x";

  const unEstimatedUserOp = {
    sender: simpleAccountAddress,
    nonce: await entryPoint.getNonce(simpleAccountAddress, 0),
    initCode,
    callData,
    paymasterAndData: "0x",
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    callGasLimit: BigInt(call),
    verificationGasLimit: BigInt(verification),
    preVerificationGas: BigInt(preverification),
    signature: "0x",
  };

  const hash = await entryPoint.getUserOpHash(unEstimatedUserOp);
  unEstimatedUserOp.signature = await wallet.signMessage(ethers.getBytes(hash));

  const tx = await entryPoint.handleOps([unEstimatedUserOp], eoaPublicKey, { gasLimit: 2_000_000 });
  const receipt = await tx.wait();

  const gasUsed = receipt.gasUsed.toString();
  const txHash = receipt.hash;

  console.log(`\n✅ callGasLimit: ${call}`);
  console.log(`✅ verificationGasLimit: ${verification}`);
  console.log(`✅ preVerificationGas: ${preverification}`);
  console.log(`⛽ gasUsed: ${gasUsed}`);
  console.log(`📦 TxHash: ${txHash}`);

  return Number(gasUsed);
}

async function fitnessFn(paramsArray) {
  const [call, verification, preverification] = paramsArray.map(x => Math.floor(x));
  try {
    const gasUsed = await runUserOpWithGasParams(call, verification, preverification);
    return -gasUsed;
  } catch (e) {
    console.error("Simulation failed:", e.message);
    return -1e9;
  }
}

async function optimizeGas() {
  const initialPopulation = Array.from({ length: config.population_size }, () =>
    [
      Math.random() * (bounds.callGasLimit.max - bounds.callGasLimit.min) + bounds.callGasLimit.min,
      Math.random() * (bounds.verificationGasLimit.max - bounds.verificationGasLimit.min) + bounds.verificationGasLimit.min,
      Math.random() * (bounds.preVerificationGas.max - bounds.preVerificationGas.min) + bounds.preVerificationGas.min,
    ]
  );

  let population = initialPopulation.map(entity => ({ entity, fitness: null }));

  let bestEntity = null;
  let bestFitness = -Infinity;

  for (let i = 0; i < config.max_num_iteration; i++) {
    for (let j = 0; j < population.length; j++) {
      const entity = population[j].entity;
      const fitness = await fitnessFn(entity);
      population[j].fitness = fitness;
      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestEntity = entity;
      }
    }

const ga = GeneticAlgorithmConstructor({
  mutationFunction: (phenotype) => phenotype.map((val, i) => {
    const min = [bounds.callGasLimit.min, bounds.verificationGasLimit.min, bounds.preVerificationGas.min][i];
    const max = [bounds.callGasLimit.max, bounds.verificationGasLimit.max, bounds.preVerificationGas.max][i];
    const newVal = val + (Math.random() - 0.5) * 1000;
    return Math.max(min, Math.min(max, newVal));
  }),
  crossoverFunction: (a, b) => {
    const child1 = a.map((val, i) => (Math.random() < 0.5 ? val : b[i]));
    const child2 = b.map((val, i) => (Math.random() < 0.5 ? val : a[i]));
    return [child1, child2];
  },
  fitnessFunction: async (entity) => {
    const fitness = await fitnessFn(entity);
    return fitness;
  },
  population: population.map(p => p.entity),
  ...config,
});

const newPopulation = ga.evolve().population();
population = newPopulation.map(entity => ({ entity, fitness: null }));
console.log(`Iteration ${i + 1}: Best gasUsed = ${-bestFitness}`);
} // Close the for loop

console.log("\n✅ Best gas values found:", {
  callGasLimit: Math.floor(bestEntity[0]),
  verificationGasLimit: Math.floor(bestEntity[1]),
  preVerificationGas: Math.floor(bestEntity[2]),
  gasUsed: -bestFitness,
});
} // Close the optimizeGas function

optimizeGas();
