import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Dispute", function () {
  async function deployFixture() {
    const factory = await ethers.getContractFactory("Dispute");
    const dispute = await factory.deploy();
    return { dispute };
  }

  it("files a flag with ProvisionallyRejected status", async function () {
    const { dispute } = await deployFixture();

    const did = "did:example:client-9";
    const roundNumber = 3;
    const reason = "suspicion score above threshold";
    const tx = await dispute.fileFlag(did, roundNumber, reason, 3600);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const record = await dispute.getDispute(0);
    expect(record.did).to.equal(did);
    expect(record.roundNumber).to.equal(BigInt(roundNumber));
    expect(record.status).to.equal(0n); // ProvisionallyRejected
    expect(record.deadline).to.equal(BigInt(block!.timestamp) + 3600n);
  });

  it("overturns a flag before the deadline", async function () {
    const { dispute } = await deployFixture();

    await dispute.fileFlag(
      "did:example:client-9",
      3,
      "suspicion score above threshold",
      3600
    );
    await expect(dispute.overturn(0, "evidence-exonerating"))
      .to.emit(dispute, "Overturned")
      .withArgs(0n, "evidence-exonerating");

    const record = await dispute.getDispute(0);
    expect(record.status).to.equal(2n); // Overturned
  });

  it("finalizes a flag after a short window expires", async function () {
    const { dispute } = await deployFixture();

    await dispute.fileFlag("did:example:client-9", 4, "late finalize", 60);
    await time.increase(61);
    await expect(dispute.finalize(0))
      .to.emit(dispute, "Finalized")
      .withArgs(0n, 1n); // FinalizedRejected

    const record = await dispute.getDispute(0);
    expect(record.status).to.equal(1n); // FinalizedRejected
  });

  it("reverts overturn when called after the deadline", async function () {
    const { dispute } = await deployFixture();

    await dispute.fileFlag("did:example:client-9", 4, "late overturn", 60);
    await time.increase(61);

    await expect(
      dispute.overturn(0, "too-late-evidence")
    ).to.be.revertedWith("challenge window closed");
  });
});
