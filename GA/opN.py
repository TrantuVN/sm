import numpy as np
import random
from numpy.random import seed
from geneticalgorithm import geneticalgorithm as ga
import os
import json
import logging
import csv
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def run_simulation(params, bundle_size=1):
    callGas, verGas, preGas, maxFee, priorityFee = params

    userOp = {
        "callGasLimit": int(callGas),
        "verificationGasLimit": int(verGas),
        "preVerificationGas": int(preGas),
        "maxFeePerGas": float(maxFee),
        "maxPriorityFeePerGas": float(priorityFee),
        "bundleSize": bundle_size,
        "callData": "0xa9059cbb000000000000000000000000dc00314962e3aced0094b01e6a0ecb8946e1218e0000000000000000000000000000000000000000000000000000000000000064"
    }

    try:
        isValid = (
            callGas >= 10000 and
            verGas >= 10000 and
            preGas >= 21000 and
            maxFee >= priorityFee and
            maxFee >= 0.1
        )

        if not isValid:
            gas_result = {"gas": "invalid", "latency": 0}
            logging.warning(f"Invalid parameters: {params}")
            cost = 1e6
            latency = 0
        else:
            # Simulate gas and latency for bundle_size UserOperations
            dummy_gas = (callGas + verGas + preGas + 10000) * bundle_size
            base_latency = 1000
            latency_reduction = min(priorityFee * 100, 900)
            latency = max(base_latency - latency_reduction, 100) * bundle_size  # Scale latency with bundle_size

            gas_result = {
                "gas": dummy_gas,
                "latency": latency
            }

            gas_cost = dummy_gas * (maxFee + priorityFee) / 1e9
            latency_penalty = latency / 1000
            cost = gas_cost + (latency_penalty * 0.001)

        logging.info(f"Simulated result for {bundle_size} UserOps: gas={gas_result['gas']}, latency={latency}ms")
        return cost

    except Exception as e:
        logging.error(f"Simulation error: {e}")
        return 1e6

def simulate_validation(x, bundle_size=1):
    return run_simulation(x, bundle_size=bundle_size)

# GA parameters
varbound = np.array([
    [20000, 50000],    # callGasLimit
    [20000, 40000],    # verificationGasLimit
    [21000, 100000],   # preVerificationGas
    [1.0, 10.0],       # maxFeePerGas (Gwei)
    [0.1, 5.0],        # maxPriorityFeePerGas (Gwei)
])

algorithm_param = {
    'max_num_iteration': 100,
    'population_size': 1000,
    'mutation_probability': 0.1,
    'elit_ratio': 0.1,
    'crossover_probability': 0.3,
    'parents_portion': 0.3,
    'crossover_type': 'uniform',
    'max_iteration_without_improv': 10,
    'function_timeout': 30
}

# List of bundle sizes to test
bundle_sizes = [5, 10, 100, 1000]
num_runs = 20  # Number of runs per bundle size
output_dir = "GA_multi_userops"
os.makedirs(output_dir, exist_ok=True)

# CSV to store all results
csv_path = os.path.join(output_dir, "multi_userops_results.csv")
with open(csv_path, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["Bundle Size", "Run", "callGasLimit", "verificationGasLimit", "preVerificationGas", 
                    "maxFeePerGas", "maxPriorityFeePerGas", "Fitness"])

    # Run GA for each bundle size
    all_solutions = {}
    all_fitnesses = {}
    for bundle_size in bundle_sizes:
        solutions = []
        fitnesses = []
        logging.info(f"\nStarting GA optimization for bundle_size={bundle_size}")
        
        for run in range(num_runs):
            logging.info(f"Starting GA run {run+1}/{num_runs} for bundle_size={bundle_size}")
            seed(run)
            random.seed(run)
            
            # Run GA
            model = ga(
                function=lambda x: simulate_validation(x, bundle_size=bundle_size),
                dimension=5,
                variable_type_mixed=np.array(['int', 'int', 'int', 'real', 'real']),
                variable_boundaries=varbound,
                algorithm_parameters=algorithm_param
            )
            model.run()
            
            # Store results
            best_solution = model.output_dict['variable']
            best_fitness = model.output_dict['function']
            solutions.append(best_solution)
            fitnesses.append(best_fitness)

            # Save UserOperation
            userOp = {
                "callGasLimit": int(best_solution[0]),
                "verificationGasLimit": int(best_solution[1]),
                "preVerificationGas": int(best_solution[2]),
                "maxFeePerGas": float(best_solution[3]),
                "maxPriorityFeePerGas": float(best_solution[4]),
                "bundleSize": bundle_size,
                "callData": "0xa9059cbb000000000000000000000000dc00314962e3aced0094b01e6a0ecb8946e1218e0000000000000000000000000000000000000000000000000000000000000064"
            }
            userop_path = os.path.join(output_dir, f"userOp_bundle{bundle_size}_run{run+1}.json")
            with open(userop_path, "w") as f:
                json.dump(userOp, f, ensure_ascii=False, indent=2)

            # Save gas output
            gas_result = {
                "gas": (best_solution[0] + best_solution[1] + best_solution[2] + 10000) * bundle_size,
                "latency": max(1000 - min(best_solution[4] * 100, 900), 100) * bundle_size
            }
            gas_path = os.path.join(output_dir, f"gasOutput_bundle{bundle_size}_run{run+1}.json")
            with open(gas_path, "w") as f:
                json.dump(gas_result, f, indent=2)

            # Write to CSV
            writer.writerow([bundle_size, run+1] + best_solution.tolist() + [best_fitness])
            
            print(f"Bundle Size {bundle_size}, Run {run+1}: Best solution: {best_solution}")
            print(f"Bundle Size {bundle_size}, Run {run+1}: Best fitness: {best_fitness}")

        all_solutions[bundle_size] = solutions
        all_fitnesses[bundle_size] = fitnesses

        # Print best for this bundle size
        best_idx = np.argmin(fitnesses)
        print(f"\nBest configuration for bundle_size={bundle_size}:")
        print(f"Best solution: {solutions[best_idx]}")
        print(f"Best fitness: {fitnesses[best_idx]}")

        # Statistical analysis for this bundle size
        mean_fitness = np.mean(fitnesses)
        std_fitness = np.std(fitnesses)
        print(f"\nStatistical Analysis for bundle_size={bundle_size}:")
        print(f"Mean Fitness: {mean_fitness:.7f} ETH")
        print(f"Standard Deviation of Fitness: {std_fitness:.7f} ETH")

# Plot fitness vs bundle size
plt.figure(figsize=(12, 6))
for bundle_size in bundle_sizes:
    fitnesses = all_fitnesses[bundle_size]
    mean_fitness = np.mean(fitnesses)
    plt.scatter([bundle_size] * len(fitnesses), fitnesses, alpha=0.5, label=f"N={bundle_size}")
    plt.plot([bundle_size], [mean_fitness], marker='o', color='red', markersize=10)
plt.title("Fitness vs Number of UserOperations")
plt.xlabel("Bundle Size (Number of UserOperations)")
plt.ylabel("Fitness (ETH)")
plt.xscale('log')
plt.grid(True)
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "fitness_vs_bundle_size.png"))
plt.close()

# Print overall summary
print("\n===============================")
print("Overall Summary:")
for bundle_size in bundle_sizes:
    best_idx = np.argmin(all_fitnesses[bundle_size])
    print(f"Bundle Size {bundle_size}:")
    print(f"  Best solution: {all_solutions[bundle_size][best_idx]}")
    print(f"  Best fitness: {all_fitnesses[bundle_size][best_idx]}")
print(f"All results saved to: {csv_path}")