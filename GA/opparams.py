from geneticalgorithm import geneticalgorithm as ga
import numpy as np
import os
import json
import logging

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Simulation cost function
def run_simulation(params):
    try:
        callGas, verGas, preGas, maxFee, priorityFee = params

        # Convert and validate types
        callGas = int(callGas)
        verGas = int(verGas)
        preGas = int(preGas)
        maxFee = float(maxFee)
        priorityFee = float(priorityFee)

        # Build userOp dictionary
        userOp = {
            "callGasLimit": callGas,
            "verificationGasLimit": verGas,
            "preVerificationGas": hex(preGas),
            "maxFeePerGas": hex(int(maxFee * 1e9)),           # Gwei to Wei
            "maxPriorityFeePerGas": hex(int(priorityFee * 1e9)),
            "bundleSize": 1
        }

        # Save userOp input to disk
        os.makedirs("GA", exist_ok=True)
        with open(os.path.join("GA", "userOp.json"), "w") as f:
            json.dump(userOp, f, ensure_ascii=False, indent=2)
        
        # Validation rules
        gas_cost = (callGas + verGas + preGas) * maxFee / 1e9  # ETH
        isValid = (
            callGas >= 20000 and
            verGas >= 20000 and
            preGas >= 21000 and
            maxFee >= priorityFee and
            maxFee >= 0.1 and
            priorityFee >= 0.01 and
            gas_cost < 0.0005
        )

        if not isValid:
            logging.warning(f"❌ Invalid parameters: {params} → Estimated cost: {gas_cost:.6f} ETH")
            gas_result = {"gas": "invalid"}
            cost = 1e6  # Penalty
        else:
            # Simulated gas used
            dummy_gas = callGas + verGas + preGas + 10000
            gas_result = {"gas": dummy_gas}
            cost = dummy_gas * (maxFee + priorityFee) / 1e9

            logging.info(f"✅ Valid: {params} → Cost: {cost:.8f} ETH")

        # Save simulation output
        with open(os.path.join("GA", "gasOutput.json"), "w") as f:
            json.dump(gas_result, f, indent=2)

        return cost  # Note: Use negative cost if you want to maximize fitness

    except Exception as e:
        logging.error(f"Simulation error: {e}")
        return 1e6

# Wrapper for the GA library
def simulate_validation(x):
    return run_simulation(x)

# Variable bounds: [min, max] for each parameter
varbound = np.array([
    [20000, 50000],    # callGasLimit
    [20000, 40000],    # verificationGasLimit
    [21000, 100000],   # preVerificationGas
    [0.1, 2.0],        # maxFeePerGas (Gwei)
    [0.01, 1.0],       # maxPriorityFeePerGas (Gwei)
])

# Genetic algorithm parameters
algorithm_param = {
    'max_num_iteration': 100,
    'population_size': 1000,
    'mutation_probability': 0.1,
    'elit_ratio': 0.1,
    'crossover_probability': 0.3,
    'parents_portion': 0.3,
    'crossover_type': 'uniform',
    'max_iteration_without_improv': 10
}

# Instantiate and run the GA
model = ga(
    function=simulate_validation,
    dimension=5,
    variable_type_mixed=np.array(['int', 'int', 'int', 'real', 'real']),
    variable_boundaries=varbound,
    algorithm_parameters=algorithm_param
)

model.run()

# Extract and print best result
best_solution = model.output_dict['variable']
best_fitness = model.output_dict['function']
print(f"\n✅ Best solution: {best_solution}")
print(f"💸 Estimated ETH cost: {best_fitness:.10f} ETH")