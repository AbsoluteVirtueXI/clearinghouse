/* eslint-disable comma-dangle */
/* eslint-disable no-unused-expressions */
const { contract, accounts, web3 } = require('@openzeppelin/test-environment');
const { BN, expectRevert, expectEvent, ether } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

function toEthSignedMessageHash(messageHex) {
  const messageBuffer = Buffer.from(messageHex.substring(2), 'hex');
  const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${messageBuffer.length}`);
  return web3.utils.sha3(Buffer.concat([prefix, messageBuffer]));
}

function fixSignature(signature) {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }
  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}

// signs message in node (ganache auto-applies "Ethereum Signed Message" prefix)
async function signMessage(signer, messageHex = '0x') {
  return fixSignature(await web3.eth.sign(messageHex, signer));
}

/**
 * Create a signer between a contract and a signer for a voucher of method, args, and redeemer
 * Note that `method` is the web3 method, not the truffle-contract method
 * @param contract TruffleContract
 * @param signer address
 * @param redeemer address
 * @param methodName string
 * @param methodArgs any[]
 */
const getSignFor = (contract, signer) => (redeemer, methodName, methodArgs = []) => {
  const parts = [contract.address, redeemer];

  const REAL_SIGNATURE_SIZE = 2 * 65; // 65 bytes in hexadecimal string length
  const PADDED_SIGNATURE_SIZE = 2 * 96; // 96 bytes in hexadecimal string length
  const DUMMY_SIGNATURE = `0x${web3.utils.padLeft('', REAL_SIGNATURE_SIZE)}`;

  // if we have a method, add it to the parts that we're signing
  if (methodName) {
    if (methodArgs.length > 0) {
      parts.push(
        contract.contract.methods[methodName](...methodArgs.concat([DUMMY_SIGNATURE]))
          .encodeABI()
          .slice(0, -1 * PADDED_SIGNATURE_SIZE)
      );
    } else {
      const abi = contract.abi.find((abi) => abi.name === methodName);
      parts.push(abi.signature);
    }
  }

  // return the signature of the "Ethereum Signed Message" hash of the hash of `parts`
  const messageHex = web3.utils.soliditySha3(...parts);
  return signMessage(signer, messageHex);
};

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
  context('ClearingHouse: withdraw tokens', async function () {
    before(async function () {
      this.nonce = 0;
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
      // Users have to approve ClearingHouse contract
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user1 });
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user2 });
      await this.token1.approve(this.clearingHouse.address, ether('100'), { from: user3 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user1 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user2 });
      await this.token2.approve(this.clearingHouse.address, ether('100'), { from: user3 });
      // Owner approves Tokens in ClearingHouse
      await this.clearingHouse.addToken(this.token1.address, { from: owner });
      // Users deposit token into ClearingHouse
      await this.clearingHouse.deposit(this.token1.address, RECEIVER, ether('50'), { from: user1 });
    });
    it('withdraws tokens', async function () {
      this.nonce += 1;
      const hash = web3.utils.soliditySha3(this.token1.address, ether('40'), this.nonce, user1);
      const signature = fixSignature(await web3.eth.sign(hash, owner));
      await this.clearingHouse.withdraw(this.token1.address, ether('40'), this.nonce, signature, { from: user1 });
      expect(await this.token1.balanceOf(user1)).to.be.a.bignumber.equal(ether('90'));
    });
    /*
    it('reverts is nonce is invalid', async function () {
      await expectRevert(this.clearingHouse.withdraw());
    });
    */
  });
});
