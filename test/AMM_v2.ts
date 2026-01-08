import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AMM", function () {
  let amm: any;
  let token1: any;
  let token2: any;
  let owner: any;
  let user: any;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 3600);

  /* ------------------------------------------------------------ */
  /*                        GLOBAL SETUP                          */
  /* ------------------------------------------------------------ */

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");

    token1 = await MockERC20.deploy("TokenA", "TKA", INITIAL_SUPPLY);
    await token1.waitForDeployment();

    token2 = await MockERC20.deploy("TokenB", "TKB", INITIAL_SUPPLY);
    await token2.waitForDeployment();

    const AMM = await ethers.getContractFactory("AMM");
    amm = await AMM.deploy();
    await amm.waitForDeployment();
  });

  /* ------------------------------------------------------------ */
  /*                          OWNERSHIP                            */
  /* ------------------------------------------------------------ */

  describe("Ownership", function () {
    it("should set deployer as owner", async () => {
      expect(await amm.owner()).to.equal(owner.address);
    });

    it("should allow only owner to set pool tokens", async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);
      expect(await amm.token1()).to.equal(token1.target);
      expect(await amm.token2()).to.equal(token2.target);
    });

    it("should revert if non-owner sets pool tokens", async () => {
      await expect(
        amm.connect(user).setPoolTokens(token1.target, token2.target)
      ).to.be.revertedWith("Caller is not the owner");
    });

    it("should not allow pool tokens to be set twice", async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);
      await expect(
        amm.connect(owner).setPoolTokens(token1.target, token2.target)
      ).to.be.revertedWith("Tokens already set!");
    });
  });

  /* ------------------------------------------------------------ */
  /*                          FEE LOGIC                            */
  /* ------------------------------------------------------------ */

  describe("Fee Logic", function () {
    it("should allow owner to update fee", async () => {
      await amm.connect(owner).setFee(50);
      const [, , , fee] = await amm.getPoolDetails();
      expect(fee).to.equal(50);
    });

    it("should revert if fee exceeds 10%", async () => {
      await expect(
        amm.connect(owner).setFee(1001)
      ).to.be.revertedWith("Fee too high! Max 10%");
    });

    it("should revert fee update from non-owner", async () => {
      await expect(
        amm.connect(user).setFee(50)
      ).to.be.revertedWith("Caller is not the owner");
    });
  });

  /* ------------------------------------------------------------ */
  /*                     PROVIDE LIQUIDITY                        */
  /* ------------------------------------------------------------ */

  describe("Provide Liquidity", function () {
    beforeEach(async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);
    });

    it("should allow user to provide initial liquidity", async () => {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("2000");

      await token1.transfer(user.address, amount1);
      await token2.transfer(user.address, amount2);

      await token1.connect(user).approve(amm.target, amount1);
      await token2.connect(user).approve(amm.target, amount2);

      await expect(
        amm.connect(user).provide(amount1, amount2, DEADLINE)
      ).to.emit(amm, "Mint");

      const [total1, total2, totalShares] = await amm.getPoolDetails();
      expect(total1).to.equal(amount1);
      expect(total2).to.equal(amount2);
      expect(totalShares).to.be.gt(0);
    });

    it("should revert provide if deadline passed", async () => {
      await expect(
        amm.connect(user).provide(100, 100, 1)
      ).to.be.revertedWith("Transaction deadline passed!");
    });

    it("should revert provide with zero amounts", async () => {
      await expect(
        amm.connect(user).provide(0, 100, DEADLINE)
      ).to.be.revertedWith("Amounts must be > 0");
    });
  });

  /* ------------------------------------------------------------ */
  /*                        SWAP FUNCTIONS                         */
  /* ------------------------------------------------------------ */

  describe("Swap Functions", function () {
    beforeEach(async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);

      const amount = ethers.parseEther("1000");

      await token1.transfer(user.address, amount);
      await token2.transfer(user.address, amount);

      await token1.connect(user).approve(amm.target, amount);
      await token2.connect(user).approve(amm.target, amount);

      await amm.connect(user).provide(amount, amount, DEADLINE);
    });

    it("should swap token1 for token2", async () => {
      const swapAmount = ethers.parseEther("10");

      await token1.transfer(user.address, swapAmount);
      await token1.connect(user).approve(amm.target, swapAmount);

      await expect(
        amm.connect(user).swapToken1(swapAmount, 0, DEADLINE)
      ).to.emit(amm, "Swap");
    });

    it("should swap token2 for token1", async () => {
      const swapAmount = ethers.parseEther("10");

      await token2.transfer(user.address, swapAmount);
      await token2.connect(user).approve(amm.target, swapAmount);

      await expect(
        amm.connect(user).swapToken2(swapAmount, 0, DEADLINE)
      ).to.emit(amm, "Swap");
    });

    it("should revert swap if slippage too high", async () => {
      const swapAmount = ethers.parseEther("10");

      await token1.transfer(user.address, swapAmount);
      await token1.connect(user).approve(amm.target, swapAmount);

      await expect(
        amm.connect(user).swapToken1(
          swapAmount,
          ethers.parseEther("1000"),
          DEADLINE
        )
      ).to.be.revertedWith("Slippage: Output amount too low");
    });
  });

  /* ------------------------------------------------------------ */
  /*                       WITHDRAW LOGIC                          */
  /* ------------------------------------------------------------ */

  describe("Withdraw Liquidity", function () {
    beforeEach(async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);

      const amount = ethers.parseEther("1000");

      await token1.transfer(user.address, amount);
      await token2.transfer(user.address, amount);

      await token1.connect(user).approve(amm.target, amount);
      await token2.connect(user).approve(amm.target, amount);

      await amm.connect(user).provide(amount, amount, DEADLINE);
    });

    it("should allow liquidity provider to withdraw", async () => {
      const balance = await amm.balanceOf(user.address);

      await expect(
        amm.connect(user).withdraw(balance, 0, 0, DEADLINE)
      ).to.emit(amm, "Burn");
    });

    it("should revert withdraw if insufficient shares", async () => {
      await expect(
        amm.connect(user).withdraw(
          ethers.parseEther("100000"),
          0,
          0,
          DEADLINE
        )
      ).to.be.revertedWith("Insufficient shares");
    });

    it("should revert withdraw if slippage conditions fail", async () => {
      const balance = await amm.balanceOf(user.address);

      await expect(
        amm.connect(user).withdraw(
          balance,
          ethers.parseEther("10000"),
          0,
          DEADLINE
        )
      ).to.be.revertedWith("Slippage: Token1 amount too low");
    });
  });

  /* ------------------------------------------------------------ */
  /*                         VIEW FUNCTIONS                        */
  /* ------------------------------------------------------------ */

  describe("View Functions", function () {
    beforeEach(async () => {
      await amm.connect(owner).setPoolTokens(token1.target, token2.target);

      const amount = ethers.parseEther("1000");

      await token1.transfer(user.address, amount);
      await token2.transfer(user.address, amount);

      await token1.connect(user).approve(amm.target, amount);
      await token2.connect(user).approve(amm.target, amount);

      await amm.connect(user).provide(amount, amount, DEADLINE);
    });

    it("should return correct equivalent token estimates", async () => {
      const estimate = await amm.getEquivalentToken2Estimate(
        ethers.parseEther("10")
      );
      expect(estimate).to.be.gt(0);
    });

  });
});
