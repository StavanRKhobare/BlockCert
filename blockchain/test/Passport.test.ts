import { expect } from "chai";
import { ethers } from "hardhat";

describe("Passport", function () {
  async function deployFixture() {
    const factory = await ethers.getContractFactory("Passport");
    const passport = await factory.deploy();
    return { passport };
  }

  it("submits two events for one device and returns both entry IDs in order", async function () {
    const { passport } = await deployFixture();

    const deviceId = "device-001";
    await passport.submitEvent(
      deviceId,
      "repair",
      "evidence-repair-1",
      "model-v1",
      "did:example:tech-1",
      "sig-repair-1"
    );
    await passport.submitEvent(
      deviceId,
      "inspection",
      "evidence-inspection-1",
      "model-v1",
      "did:example:inspector-1",
      "sig-inspection-1"
    );

    const entryIds = await passport.getEventsForDevice(deviceId);
    expect(entryIds.length).to.equal(2);
    expect(entryIds[0]).to.equal(0n);
    expect(entryIds[1]).to.equal(1n);
  });

  it("round-trips getEvent fields exactly", async function () {
    const { passport } = await deployFixture();

    const deviceId = "device-001";
    const eventType = "resale";
    const evidenceHash = "evidence-resale-1";
    const modelVersionHash = "model-v2";
    const actorDid = "did:example:seller-1";
    const signature = "sig-resale-1";

    const tx = await passport.submitEvent(
      deviceId,
      eventType,
      evidenceHash,
      modelVersionHash,
      actorDid,
      signature
    );
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    // NOTE: `getEvent` collides with ethers v6 BaseContract.getEvent, so the
    // contract method must be invoked by its full signature. The contract
    // itself keeps the exact spec-mandated name.
    const entry = await passport["getEvent(uint256)"](0);
    expect(entry.deviceId).to.equal(deviceId);
    expect(entry.eventType).to.equal(eventType);
    expect(entry.evidenceHash).to.equal(evidenceHash);
    expect(entry.modelVersionHash).to.equal(modelVersionHash);
    expect(entry.actorDid).to.equal(actorDid);
    expect(entry.signature).to.equal(signature);
    expect(entry.timestamp).to.equal(BigInt(block!.timestamp));
  });

  it("reverts when submitting an invalid eventType", async function () {
    const { passport } = await deployFixture();

    await expect(
      passport.submitEvent(
        "device-001",
        "teleportation",
        "evidence-x",
        "model-v1",
        "did:example:actor-1",
        "sig-x"
      )
    ).to.be.revertedWith("invalid event type");
  });
});
