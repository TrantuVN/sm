import random
import numpy as np

# Simulated gas costs (based on 2024 data, e.g., 96k for SimpleAccount transfers)
BASE_GAS = 21000  # Base transaction gas
BUNDLE_OVERHEAD = 10000  # Per-bundle overhead
USEROP_GAS = 96000  # Avg gas per UserOp (e.g., transfer)

# UserOp class for simulation
class UserOp:
    def __init__(self, gas_price, gas_limit):
        self.gas_price = gas_price  # Gwei
        self.gas_limit = gas_limit  # Gas units

# Bundler configuration (genome)
class BundlerConfig:
    def __init__(self, batch_size, prioritize_high_gas):
        self.batch_size = batch_size  # Number of UserOps per bundle
        self.prioritize_high_gas = prioritize_high_gas  # True: prioritize high gas price

    def calculate_gas(self, user_ops):
        if not user_ops:
            return 0
        # Simulate gas: base + bundle overhead + per-UserOp gas
        batches = len(user_ops) // self.batch_size + (1 if len(user_ops) % self.batch_size else 0)
        total_gas = BASE_GAS + (BUNDLE_OVERHEAD * batches)
        for op in user_ops:
            total_gas += op.gas_limit
        # Add sorting cost if prioritizing
        if self.prioritize_high_gas:
            total_gas += len(user_ops) * 5000  # Simulated sorting cost
        return total_gas

# Genetic Algorithm
class GeneticAlgorithm:
    def __init__(self, population_size, generations, user_ops):
        self.population_size = population_size
        self.generations = generations
        self.user_ops = user_ops
        self.population = self.initialize_population()

    def initialize_population(self):
        return [BundlerConfig(
            batch_size=random.randint(5, 50),  # Batch size range
            prioritize_high_gas=random.choice([True, False])
        ) for _ in range(self.population_size)]

    def fitness(self, config):
        # Lower gas is better (invert for fitness)
        return 1 / (config.calculate_gas(self.user_ops) + 1)

    def select(self):
        # Tournament selection
        tournament = random.sample(self.population, 3)
        return max(tournament, key=self.fitness)

    def crossover(self, parent1, parent2):
        # Blend batch size, inherit prioritization
        child_batch_size = (parent1.batch_size + parent2.batch_size) // 2
        child_prioritize = parent1.prioritize_high_gas if random.random() < 0.5 else parent2.prioritize_high_gas
        return BundlerConfig(child_batch_size, child_prioritize)

    def mutate(self, config):
        # Mutate batch size or prioritization
        if random.random() < 0.1:
            config.batch_size = min(max(config.batch_size + random.randint(-5, 5), 5), 50)
        if random.random() < 0.1:
            config.prioritize_high_gas = not config.prioritize_high_gas
        return config

    def evolve(self):
        for _ in range(self.generations):
            new_population = []
            for _ in range(self.population_size):
                parent1, parent2 = self.select(), self.select()
                child = self.crossover(parent1, parent2)
                child = self.mutate(child)
                new_population.append(child)
            self.population = new_population
        return max(self.population, key=self.fitness)

# Simulate UserOps (e.g., 100 UserOps with varied gas prices/limits)
user_ops = [UserOp(gas_price=random.randint(10, 50), gas_limit=USEROP_GAS) for _ in range(100)]

# Run GA
ga = GeneticAlgorithm(population_size=50, generations=100, user_ops=user_ops)
best_config = ga.evolve()

# Output results
print(f"Optimal Batch Size: {best_config.batch_size}")
print(f"Prioritize High Gas: {best_config.prioritize_high_gas}")
print(f"Estimated Gas: {best_config.calculate_gas(user_ops)}")