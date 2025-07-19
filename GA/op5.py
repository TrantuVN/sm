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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def run_simulation(params):
    callGas, verGas, preGas, maxFee, priorityFee = params

    userOp = {
        "callGasLimit": int(callGas),
        "verificationGasLimit": int(verGas),
        "preVerificationGas": int(preGas),
        "maxFeePerGas": float(maxFee),
        "maxPriorityFeePerGas": float(priorityFee),
        "bundleSize": 1,
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
            dummy_gas = callGas + verGas + preGas + 10000
            base_latency = 1000
            latency_reduction = min(priorityFee * 100, 900)
            latency = max(base_latency - latency_reduction, 100)

            gas_result = {
                "gas": dummy_gas,
                "latency": latency
            }

            gas_cost = dummy_gas * (maxFee + priorityFee) / 1e9
            latency_penalty = latency / 1000
            cost = gas_cost + (latency_penalty * 0.001)

        logging.info(f"Simulated result: gas={gas_result['gas']}, latency={latency}ms")
        return cost

    except Exception as e:
        logging.error(f"Simulation error: {e}")
        return 1e6

def simulate_validation(x):
    return run_simulation(x)

varbound = np.array([
    [20000, 50000],    # callGasLimit
    [20000, 40000],    # verificationGasLimit
    [21000, 100000],   # preVerificationGas
    [1.0, 10.0],       # maxFeePerGas (Gwei)
    [0.1, 5.0],        # maxPriorityFeePerGas (Gwei)
])

algorithm_param = {
    'max_num_iteration': 100,
    'population_size': 100,
    'mutation_probability': 0.3,
    'elit_ratio': 0.1,
    'crossover_probability': 0.7,
    'parents_portion': 0.3,
    'crossover_type': 'uniform',
    'max_iteration_without_improv': 10,
    'function_timeout': 30  # Increased timeout
}

solutions = []
fitnesses = []
num_runs = 5
csv_path = os.path.join("GA", "multi_run_results.csv")

with open(csv_path, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["Run", "callGasLimit", "verificationGasLimit", "preVerificationGas", "maxFeePerGas", "maxPriorityFeePerGas", "Fitness"])

    for run in range(num_runs):
        logging.info(f"Starting GA run {run+1}/{num_runs}")
        seed(run)
        random.seed(run)
        model = ga(
            function=simulate_validation,
            dimension=5,
            variable_type_mixed=np.array(['int', 'int', 'int', 'real', 'real']),
            variable_boundaries=varbound,
            algorithm_parameters=algorithm_param
        )
        model.run()
        best_solution = model.output_dict['variable']
        best_fitness = model.output_dict['function']
        solutions.append(best_solution)
        fitnesses.append(best_fitness)

        # Save userOp and gasOutput for best solution
        best_params = best_solution
        userOp = {
            "callGasLimit": int(best_params[0]),
            "verificationGasLimit": int(best_params[1]),
            "preVerificationGas": int(best_params[2]),
            "maxFeePerGas": float(best_params[3]),
            "maxPriorityFeePerGas": float(best_params[4]),
            "bundleSize": 1,
            "callData": "0xa9059cbb000000000000000000000000dc00314962e3aced0094b01e6a0ecb8946e1218e0000000000000000000000000000000000000000000000000000000000000064"
        }
        os.makedirs("GA", exist_ok=True)
        with open(os.path.join("GA", f"userOp_run{run+1}.json"), "w") as f:
            json.dump(userOp, f, ensure_ascii=False, indent=2)

        gas_result = {
            "gas": best_params[0] + best_params[1] + best_params[2] + 10000,
            "latency": max(1000 - min(best_params[4] * 100, 900), 100)
        }
        with open(os.path.join("GA", f"gasOutput_run{run+1}.json"), "w") as f:
            json.dump(gas_result, f, indent=2)

        print(f"Run {run+1}: Best solution: {best_solution}")
        print(f"Run {run+1}: Best fitness: {best_fitness}")

        writer.writerow([run+1] + best_solution.tolist() + [best_fitness])

# Print best overall
best_idx = np.argmin(fitnesses)
print("\n===============================")
print("Best overall configuration:")
print(f"Best solution: {solutions[best_idx]}")
print(f"Best fitness: {fitnesses[best_idx]}")
print(f"All results saved to: {csv_path}")

# Plot fitness vs run
plt.figure(figsize=(10, 5))
plt.plot(range(1, num_runs + 1), fitnesses, marker='o', linestyle='-', color='blue')
plt.title("Fitness per GA Run")
plt.xlabel("Run Number")
plt.ylabel("Fitness (ETH)")
plt.grid(True)
plt.tight_layout()
plt.savefig(os.path.join("GA", "fitness_plot.png"))
plt.close()  # Close plot to release resources