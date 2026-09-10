import { expect } from "chai";
import { ethers } from "hardhat";

describe("CheckpointAnchor", function () {
  async function deployFixture() {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CheckpointAnchor");
    const anchor = await factory.deploy();
    return { anchor, owner };
  }

  it("anchors one checkpoint and reads it back exactly", async function () {
    const { anchor, owner } = await deployFixture();

    const roundNumber = 1;
    const weightsHash = "hash-round-1";
    const offChainUri = "ipfs://weights-round-1";
    const parentHash = "genesis";
    const isDelta = false;

    const tx = await anchor.anchorCheckpoint(
      roundNumber,
      weightsHash,
      offChainUri,
      parentHash,
      isDelta
    );
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const checkpoint = await anchor.getCheckpoint(0);
    expect(checkpoint.roundNumber).to.equal(BigInt(roundNumber));
    expect(checkpoint.weightsHash).to.equal(weightsHash);
    expect(checkpoint.offChainUri).to.equal(offChainUri);
    expect(checkpoint.parentHash).to.equal(parentHash);
    expect(checkpoint.isDelta).to.equal(isDelta);
    expect(checkpoint.submitter).to.equal(owner.address);
    expect(checkpoint.timestamp).to.equal(BigInt(block!.timestamp));
  });

  it("anchoring three checkpoints makes getLatestCheckpointId() return 2", async function () {
    const { anchor } = await deployFixture();

    for (let i = 0; i < 3; i++) {
      await anchor.anchorCheckpoint(
        i,
        `hash-${i}`,
        `ipfs://weights-${i}`,
        i === 0 ? "genesis" : `hash-${i - 1}`,
        i > 0
      );
    }

    expect(await anchor.getLatestCheckpointId()).to.equal(2n);
  });

  it("emits CheckpointAnchored with fields matching the call arguments", async function () {
    const { anchor, owner } = await deployFixture();

    const roundNumber = 7;
    const weightsHash = "hash-round-7";
    const offChainUri = "ipfs://weights-round-7";
    const parentHash = "hash-round-6";
    const isDelta = true;

    const txPromise = anchor.anchorCheckpoint(
      roundNumber,
      weightsHash,
      offChainUri,
      parentHash,
      isDelta
    );
    const tx = await txPromise;
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    await expect(txPromise)
      .to.emit(anchor, "CheckpointAnchored")
      .withArgs(
        0n,
        BigInt(roundNumber),
        weightsHash,
        offChainUri,
        parentHash,
        isDelta,
        owner.address,
        BigInt(block!.timestamp)
      );
  });
});
