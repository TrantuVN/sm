const hre = require("hardhat");
const fs = require("fs");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const GeneticAlgorithmConstructor = require("geneticalgorithm");
const { createGasEstimator } = require("@biconomy/gas-estimations");
const { http, createPublicClient } = require("viem");
const { sepolia } = require("viem/chains");

const {
  entryPointAddress,
  eoaPrivateKey,
  eoaPublicKey,
  accountFactoryAddress,
  simpleAccountAddress,
  tokenAddress,
} = require("../addressConfig");

const config = {
  max_num_iteration: 50,
  population_size: 100,
  mutation_probability: 0.1,
  elit_ratio: 0.1,
  crossover_probability: 0.3,
  parents_portion: 0.3,
  crossover_type: "uniform",
  max_iteration_without_improv: 10,
};

const bounds = {
  callGasLimit: { min: 350_000, max: 900_000 }, // Narrowed based on prior results
  verificationGasLimit: { min: 170_000, max: 450_000 },
  preVerificationGas: { min: 30_000, max: 170_000 },
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

  const initCode =
    (await provider.getCode(simpleAccountAddress)) === "0x"
      ? accountFactoryAddress + AccountFactory.interface.encodeFunctionData("createAccount", [eoaPublicKey, 0]).slice(2)
      : "0x";

  const userOp = {
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

  const hash = await entryPoint.getUserOpHash(userOp);
  userOp.signature = await wallet.signMessage(ethers.getBytes(hash));

  const tx = await entryPoint.handleOps([userOp], eoaPublicKey, { gasLimit: 2_000_000 });
  const receipt = await tx.wait();

  console.log(`✅ callGasLimit: ${call}`);
  console.log(`✅ verificationGasLimit: ${verification}`);
  console.log(`✅ preVerificationGas: ${preverification}`);
  console.log(`⛽ gasUsed: ${receipt.gasUsed}`);
  console.log(`📦 TxHash: ${receipt.hash}`);

  return Number(receipt.gasUsed);
}

async function fitnessFn(paramsArray) {
  const [call, verification, preverification] = paramsArray.map(Math.floor);
  try {
    const gasUsed = await runUserOpWithGasParams(call, verification, preverification);
    return -gasUsed;
  } catch (e) {
    console.error("Simulation failed:", e.message);
    return -1e9;
  }
}

async function plotFitnessHistory(history) {
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });
  const config = {
    type: "line",
    data: {
      labels: history.map((_, i) => `Gen ${i + 1}`),
      datasets: [
        {
          label: "Best Gas Used per Generation",
          data: history,
          borderColor: "blue",
          fill: false,
          tension: 0.1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Gas Optimization Over Generations",
        },
      },
      scales: {
        y: { title: { display: true, text: "Gas Used" } },
        x: { title: { display: true, text: "Generation" } },
      },
    },
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  fs.writeFileSync("fitness_chart.png", buffer);
  console.log("📊 Saved fitness chart to fitness_chart.png");
}

async function optimizeGas() {
  const initialPopulation = Array.from({ length: config.population_size }, () => [
    Math.random() * (bounds.callGasLimit.max - bounds.callGasLimit.min) + bounds.callGasLimit.min,
    Math.random() * (bounds.verificationGasLimit.max - bounds.verificationGasLimit.min) + bounds.verificationGasLimit.min,
    Math.random() * (bounds.preVerificationGas.max - bounds.preVerificationGas.min) + bounds.preVerificationGas.min,
  ]);

  let population = initialPopulation.map((entity) => ({ entity, fitness: null }));
  let bestEntity = null;
  let bestFitness = -Infinity;
  const fitnessHistory = [];
  const startTime = Date.now();

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

    fitnessHistory.push(-bestFitness);
    console.log(`\n📈 Iteration ${i + 1}: Best gasUsed = ${-bestFitness}`);

    const ga = GeneticAlgorithmConstructor({
      mutationFunction: (phenotype) =>
        phenotype.map((val, i) => {
          const min = Object.values(bounds)[i].min;
          const max = Object.values(bounds)[i].max;
          const delta = (Math.random() - 0.5) * 1000;
          return Math.max(min, Math.min(max, val + delta));
        }),
      crossoverFunction: (a, b) => [
        a.map((val, i) => (Math.random() < 0.5 ? val : b[i])),
        b.map((val, i) => (Math.random() < 0.5 ? val : a[i])),
      ],
      fitnessFunction: async (entity) => await fitnessFn(entity),
      population: population.map((p) => p.entity),
      ...config,
    });

    const newPopulation = ga.evolve().population();
    population = newPopulation.map((entity) => ({ entity, fitness: null }));
  }

  const endTime = Date.now();
  console.log(`\n🕒 Total optimization time: ${(endTime - startTime) / 1000}s`);

  const bestParams = {
    callGasLimit: Math.floor(bestEntity[0]),
    verificationGasLimit: Math.floor(bestEntity[1]),
    preVerificationGas: Math.floor(bestEntity[2]),
    gasUsed: -bestFitness,
  };

  console.log("\n✅ Best gas parameters found:", bestParams);
  fs.writeFileSync("bestGasParams.json", JSON.stringify(bestParams, null, 2));
  console.log("💾 Saved best parameters to bestGasParams.json");
  await plotFitnessHistory(fitnessHistory);

  // Execute final user operation with optimized parameters
  console.log("\n🚀 Executing final user operation with optimized parameters...");
  const finalGasUsed = await runUserOpWithGasParams(
    Math.floor(bestEntity[0]),
    Math.floor(bestEntity[1]),
    Math.floor(bestEntity[2])
  );
  console.log(`\n✅ Final user operation gasUsed: ${finalGasUsed}`);
}

optimizeGas();