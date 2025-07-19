const hre = require("hardhat");
const {  updateConfig } = require('./helpers/updateConfig');
async function main() {
    // Deploy the EntryPoint contract
    const tk = await hre.ethers.deployContract("Token");

    // Wait for the deployment transaction to be mined
    await tk.waitForDeployment();

    // Log the deployed address of the EntryPoint contract
    console.log(`Token deployed to ${tk.target}`);
    updateConfig('tokenAddress', tk.target);
}

// Handle errors during deployment
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});