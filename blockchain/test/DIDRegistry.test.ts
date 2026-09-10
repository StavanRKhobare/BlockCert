import { expect } from "chai";
import { ethers } from "hardhat";

describe("DIDRegistry", function () {
  async function deployFixture() {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DIDRegistry");
    const registry = await factory.deploy();
    return { registry, owner };
  }

  it("registers one DID and reads it back exactly", async function () {
    const { registry, owner } = await deployFixture();

    const did = "did:example:client-1";
    const publicKey = "pubkey-abc";
    const displayName = "Client One";

    const tx = await registry.registerDID(did, publicKey, displayName);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const record = await registry.getDID(did);
    expect(record.publicKey).to.equal(publicKey);
    expect(record.displayName).to.equal(displayName);
    expect(record.owner).to.equal(owner.address);
    expect(record.timestamp).to.equal(BigInt(block!.timestamp));
    expect(await registry.isRegistered(did)).to.equal(true);
  });

  it("reverts when registering the same DID twice", async function () {
    const { registry } = await deployFixture();

    const did = "did:example:client-1";
    await registry.registerDID(did, "pubkey-abc", "Client One");

    await expect(
      registry.registerDID(did, "pubkey-other", "Client Other")
    ).to.be.revertedWith("DID already registered");
  });

  it("reports isRegistered as false for an unregistered DID", async function () {
    const { registry } = await deployFixture();

    expect(await registry.isRegistered("did:example:nobody")).to.equal(false);
  });
});
