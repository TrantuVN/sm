const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Voting contract with account:", deployer.address);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const tokenAddress = "0x1d4d9534fa6abebbb7da45f5306cd252deb7e1"; // SCN token address from Etherscan
  const voting = await Voting.deploy(tokenAddress);
  await voting.deployed();

  console.log("Voting deployed to:", voting.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});