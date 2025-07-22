from geneticalgorithm import geneticalgorithm as ga
import numpy as np
import os
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def run_simulation(params):
    callGas, verGas, preGas, maxFee, priorityFee = params

    # Convert parameters to hexadecimal (Wei)
    userOp = {
        "callGasLimit": int(callGas),
        "verificationGasLimit": int(verGas),
        "preVerificationGas": '0x' + format(int(preGas), 'x'),  # Decimal to hex
        "maxFeePerGas": '0x' + format(int(maxFee * 1e9), 'x'),  # Gwei to Wei, then hex
        "maxPriorityFeePerGas": '0x' + format(int(priorityFee * 1e9), 'x'),  # Gwei to Wei, then hex
        "bundleSize": 1
    }

    # Ensure output directory exists
    os.makedirs("GA", exist_ok=True)
    with open(os.path.join("GA", "userOp.json"), "w") as f:
        json.dump(userOp, f, ensure_ascii=False, indent=2)

    try:
        # Validate parameters
        isValid = (
            callGas >= 10000 and
            verGas >= 10000 and
            preGas >= 21000 and
            maxFee >= priorityFee and
            maxFee >= 0.1 and
            priorityFee >= 0.01 and
            (callGas + verGas + preGas) * maxFee / 1e9 < 0.0005  # Ensure cost < 0.0005 ETH
        )

        if not isValid:
            gas_result = {"gas": "invalid"}
            logging.warning(f"Invalid parameters: {params}")
            cost = 1e6
        else:
            # Simulate total gas cost
            dummy_gas = callGas + verGas + preGas + 10000
            gas_result = {"gas": dummy_gas}
            cost = dummy_gas * (maxFee + priorityFee) / 1e9  # ETH

        with open(os.path.join("GA", "gasOutput.json"), "w") as f:
            json.dump(gas_result, f, indent=2)

        logging.info(f"Simulated gas result: {gas_result}")
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
    [0.1, 2.0],        # maxFeePerGas (Gwei)
    [0.01, 1.0],       # maxPriorityFeePerGas (Gwei)
])

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
print(f"Best solution: {best_solution}")
print(f"Best fitness (ETH): {best_fitness}")