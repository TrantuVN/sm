require("dotenv").config();
const fs = require("fs");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Voting contract with account:", deployer.address);

  const tokenAddress = process.env.SCN_ADDRESS || "0xfBb4c2CE857289e71289149Ee66429c34fD44322";

  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    throw new Error("Invalid SCN token address provided.");
  }

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(tokenAddress);
  await voting.waitForDeployment(); // Ethers v6 compatible

  console.log("Voting deployed to:", voting.target); // use .target instead of .address

  // Optional: Save to .env
  fs.appendFileSync(".env", `VOTING_ADDRESS=${voting.target}\n`);
  console.log("VOTING_ADDRESS saved to .env");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
