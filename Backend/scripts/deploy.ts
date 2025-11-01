import hre from "hardhat";

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  console.log("Deploying with account:", deployer.account.address);

  const bazar = await hre.viem.deployContract("Bazar", [
    deployer.account.address,
    100n
  ]);

  console.log("Bazar deployed at:", bazar.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});