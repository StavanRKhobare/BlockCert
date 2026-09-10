import { expect } from "chai";
import { ethers } from "hardhat";

describe("Staking", function () {
  async function deployFixture() {
    const [owner, staker, attacker] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("Staking");
    const staking = await factory.deploy();
    return { staking, owner, staker, attacker };
  }

  it("stakes from one account and confirms the balance", async function () {
    const { staking, staker } = await deployFixture();

    const did = "did:example:client-1";
    const amount = ethers.parseEther("1");

    await expect(staking.connect(staker).stake(did, { value: amount }))
      .to.emit(staking, "Staked")
      .withArgs(did, amount, amount);

    expect(await staking.balanceOf(did)).to.equal(amount);
  });

  it("slashes part of the stake, confirming the new balance and reason round-trip", async function () {
    const { staking, owner, staker } = await deployFixture();

    const did = "did:example:client-1";
    const staked = ethers.parseEther("1");
    const slashed = ethers.parseEther("0.4");
    const reason = "reference-set performance collapse";
    await staking.connect(staker).stake(did, { value: staked });

    const ownerBefore = await ethers.provider.getBalance(owner.address);
    const slashTx = staking.slash(did, slashed, reason);
    await expect(slashTx)
      .to.emit(staking, "Slashed")
      .withArgs(did, slashed, reason, staked - slashed);

    expect(await staking.balanceOf(did)).to.equal(staked - slashed);
    // The slashed amount is paid out to the contract owner.
    expect(await ethers.provider.getBalance(owner.address)).to.be.gt(
      ownerBefore
    );
  });

  it("reverts slash when called by a non-owner account", async function () {
    const { staking, staker, attacker } = await deployFixture();

    const did = "did:example:client-1";
    await staking
      .connect(staker)
      .stake(did, { value: ethers.parseEther("1") });

    await expect(
      staking
        .connect(attacker)
        .slash(did, ethers.parseEther("0.1"), "unauthorized attempt")
    )
      .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
      .withArgs(attacker.address);
  });

  it("reverts slash when the amount exceeds the balance", async function () {
    const { staking, staker } = await deployFixture();

    const did = "did:example:client-1";
    await staking
      .connect(staker)
      .stake(did, { value: ethers.parseEther("1") });

    await expect(
      staking.slash(did, ethers.parseEther("2"), "over-slash")
    ).to.be.revertedWith("insufficient stake");
  });
});
