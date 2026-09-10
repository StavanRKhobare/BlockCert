import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    "localhost",
    "CheckpointAnchor.json"
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
    address: string;
    abi: unknown[];
  };

  const anchor = await ethers.getContractAt(
    deployment.abi,
    deployment.address
  );

  await (
    await anchor["anchorCheckpoint(uint256,string,string,string,bool)"](
      1,
      "hash-abc",
      "local://checkpoints/1",
      "",
      false
    )
  ).wait();

  const checkpoint = await anchor["getCheckpoint(uint256)"](0);
  const roundtripped: boolean = checkpoint.weightsHash === "hash-abc";
  console.log(
    `[A7] smoke_test_roundtrip=${roundtripped ? "True" : "False"}`
  );
  if (!roundtripped) {
    throw new Error(
      `expected weightsHash "hash-abc", got "${checkpoint.weightsHash}"`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
