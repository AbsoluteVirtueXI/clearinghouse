/* eslint-disable no-unused-expressions */
const { contract, accounts } = require('@openzeppelin/test-environment');
const { BN, expectRevert, ether } = require('@openzeppelin/test-helpers');
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
  beforeEach(async function () {
    this.clearingHouse = await ClearingHouse.new(owner, { from: dev });
    this.token1 = await Token1.new('Token1', 'TK1', { from: token1Owner });
    this.token2 = await Token2.new('Token2', 'TK2', { from: token2Owner });
  });
  context('Testing context', function () {
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
  context('ClearingHouse deployment', function () {
    it('transfers ownership to owner', async function () {
      expect(await this.clearingHouse.owner()).to.equal(owner);
    });
  });
  context('ClearingHouse deployed', function () {});
});
