import { artifacts, ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const contractNames = [
    "CheckpointAnchor",
    "DIDRegistry",
    "Staking",
    "Dispute",
    "Passport",
  ];

  const outDir = path.join(__dirname, "..", "deployments", network.name);
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of contractNames) {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const artifact = await artifacts.readArtifact(name);
    const payload = {
      address,
      abi: artifact.abi,
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(payload, null, 2)
    );
    console.log(`Deployed ${name} to ${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
