/* eslint-disable comma-dangle */
/* eslint-disable no-unused-expressions */
const { contract, accounts } = require('@openzeppelin/test-environment');
const { BN, expectRevert, expectEvent, ether } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { expect } = require('chai');

const ClearingHouse = contract.fromArtifact('ClearingHouse');
const Token1 = contract.fromArtifact('Token1');
const Token2 = contract.fromArtifact('Token2');

describe('ClearingHouse', function () {
  const [dev, owner, user1, user2, user3, token1Owner, token2Owner] = accounts;
  const TOKEN1_NAME = 'Token1';
  const TOKEN1_SYMBOL = 'TK1';
  const TOKEN2_NAME = 'Token2';
  const TOKEN2_SYMBOL = 'TK2';
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
  const RECEIVER = 'f1a6dabf27e29f6164812e5a2e4c6b34b61a7d6a372a2ad0e19495088f139b09';

  context('Testing context', function () {
    beforeEach(async function () {
      this.clearingHouse = await ClearingHouse.new(owner, { from: dev });
      this.token1 = await Token1.new('Token1', 'TK1', { from: token1Owner });
      this.token2 = await Token2.new('Token2', 'TK2', { from: token2Owner });
    });
    it(`the test token1 has name ${TOKEN1_NAME}`, async function () {
      expect(await this.token1.name()).to.equal(TOKEN1_NAME);
    });
    it(`the test token1 has symbol ${TOKEN1_SYMBOL}`, async function () {
      expect(await this.token1.symbol()).to.equal(TOKEN1_SYMBOL);
    });
    it(`the test token1 has MINTER_ROLE for ${token1Owner}`, async function () {
      expect(await this.token1.hasRole(MINTER_ROLE, token1Owner)).to.be.true;
    });
    it('owner of Token1 can mint TK1', async function () {
      expect(await this.token1.mint(user1, ether('100'), { from: token1Owner }));
      expect(await this.token1.balanceOf(user1)).to.be.a.bignumber.equal(ether('100'));
    });
    it(`the test token2 has name ${TOKEN2_NAME}`, async function () {
      expect(await this.token2.name()).to.equal(TOKEN2_NAME);
    });
    it(`the test token2 has symbol ${TOKEN2_SYMBOL}`, async function () {
      expect(await this.token2.symbol()).to.equal(TOKEN2_SYMBOL);
    });
    it(`the test token2 has MINTER_ROLE for ${token1Owner}`, async function () {
      expect(await this.token2.hasRole(MINTER_ROLE, token2Owner)).to.be.true;
    });
    it('owner of Token2 can mint TK2', async function () {
      expect(await this.token2.mint(user2, ether('100'), { from: token2Owner }));
      expect(await this.token2.balanceOf(user2)).to.be.a.bignumber.equal(ether('100'));
    });
  });
  context('ClearingHouse: deployment', function () {
    beforeEach(async function () {
      this.clearingHouse = await ClearingHouse.new(owner, { from: dev });
      this.token1 = await Token1.new('Token1', 'TK1', { from: token1Owner });
      this.token2 = await Token2.new('Token2', 'TK2', { from: token2Owner });
    });
    it('transfers ownership to owner', async function () {
      expect(await this.clearingHouse.owner()).to.equal(owner);
    });
  });
  context('ClearingHouse: add/remove tokens ', function () {
    beforeEach(async function () {
      this.clearingHouse = await ClearingHouse.new(owner, { from: dev });
      this.token1 = await Token1.new('Token1', 'TK1', { from: token1Owner });
      this.token2 = await Token2.new('Token2', 'TK2', { from: token2Owner });
    });
    it('adds new supported tokens', async function () {
      expect(
        await this.clearingHouse.isSupportedToken(this.token1.address),
        `Token1: ${this.token1.address} should not be supported yet`
      ).to.be.false;
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      expect(
        await this.clearingHouse.isSupportedToken(this.token1.address),
        `Token1: ${this.token1.address} should be supported`
      ).to.be.true;
    });
    it('removes supported tokens', async function () {
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      expect(
        await this.clearingHouse.isSupportedToken(this.token1.address),
        `Token1: ${this.token1.address} should be supported`
      ).to.be.true;
      await this.clearingHouse.removeToken(this.token1.address, { from: owner });
      expect(
        await this.clearingHouse.isSupportedToken(this.token1.address),
        `Token1: ${this.token1.address} should not be supported`
      ).to.be.false;
    });
    it('reverts if addToken is not called by owner', async function () {
      await expectRevert(
        this.clearingHouse.addToken(this.token1.address, { from: dev }),
        'Ownable: caller is not the owner'
      );
    });
    it('reverts if removeToken is not called by owner', async function () {
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      await expectRevert(
        this.clearingHouse.removeToken(this.token1.address, { from: dev }),
        'Ownable: caller is not the owner'
      );
    });
    it('emits event when supported tokens added', async function () {
      const receipt = await this.clearingHouse.addToken(this.token1.address, { from: owner });
      expectEvent(receipt, 'TokenAdded', { token: this.token1.address });
    });
    it('emits event when supported tokens removed', async function () {
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      const receipt = await this.clearingHouse.removeToken(this.token1.address, { from: owner });
      expectEvent(receipt, 'TokenRemoved', { token: this.token1.address });
    });
  });
  context('ClearingHouse: deposit tokens', function () {
    beforeEach(async function () {
      this.clearingHouse = await ClearingHouse.new(owner, { from: dev });
      this.token1 = await Token1.new('Token1', 'TK1', { from: token1Owner });
      this.token2 = await Token2.new('Token2', 'TK2', { from: token2Owner });
      // Gives 100 TK1 and 100 TK2 to users
      await this.token1.mint(user1, ether('100'), { from: token1Owner });
      await this.token1.mint(user2, ether('100'), { from: token1Owner });
      await this.token1.mint(user3, ether('100'), { from: token1Owner });
      await this.token2.mint(user1, ether('100'), { from: token2Owner });
      await this.token2.mint(user2, ether('100'), { from: token2Owner });
      await this.token2.mint(user3, ether('100'), { from: token2Owner });
      // users have to approve ClearingHouse contract
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user1 });
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user2 });
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user3 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user1 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user2 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user3 });
    });
    it('deposits tokens', async function () {
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      await this.clearingHouse.addToken(this.token2.address, { from: owner });
      await this.clearingHouse.deposit(this.token1.address, RECEIVER, ether('50'), { from: user1 });
      await this.clearingHouse.deposit(this.token1.address, RECEIVER, ether('40'), { from: user2 });
      expect(await this.token1.balanceOf(this.clearingHouse.address)).to.be.a.bignumber.equal(ether('90'));
    });
    it('reverts if tokens are not supported when deposit', async function () {
      await expectRevert(
        this.clearingHouse.deposit(this.token1.address, RECEIVER, ether('50'), { from: user1 }),
        'ClearingHouse: Unsupported token'
      );
    });
    it('emits event when tokens are deposited', async function () {
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      await this.clearingHouse.addToken(this.token2.address, { from: owner });
      const receipt1 = await this.clearingHouse.deposit(this.token1.address, RECEIVER, ether('50'), { from: user1 });
      expectEvent(receipt1, 'TokensWrapped', { token: this.token1.address, receiver: RECEIVER, amount: ether('50') });
      const receipt2 = await this.clearingHouse.deposit(this.token2.address, RECEIVER, ether('50'), { from: user2 });
      expectEvent(receipt2, 'TokensWrapped', { token: this.token2.address, receiver: RECEIVER, amount: ether('50') });
    });
  });
});
