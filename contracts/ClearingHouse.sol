// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract ClearingHouse is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) private _supportedTokens;
    mapping(address => uint256) private _nonces;

    constructor(address owner) {
        transferOwnership(owner);
    }

    modifier onlySupportedToken(address token) {
        require(_supportedTokens[token], "ClearingHouse: Unsupported token");
        _;
    }

    modifier onlyValidNonce(uint256 nonce) {
        require((_nonces[msg.sender] < nonce), "ClearingHouse: Invalid nonce");
        _;
    }

    function deposit(
        address token,
        string memory receiver,
        uint256 amount
    ) public onlySupportedToken(token) {
        IERC20 tokenERC = IERC20(token);
        tokenERC.transferFrom(msg.sender, address(this), amount);
        emit TokensWrapped(token, receiver, amount);
    }

    function withdraw(
        address token,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) public onlyValidNonce(nonce) {
        _nonces[msg.sender] = nonce;
        bytes32 digest = keccak256(abi.encodePacked(token, amount, nonce, msg.sender));
        address recoveredAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), signature);
        require(recoveredAddress != address(0) && recoveredAddress == owner(), "ClearingHouse: Invalid Signature!");
        IERC20 tokenERC = IERC20(token);
        tokenERC.transfer(msg.sender, amount);
    }

    function addToken(address token) public onlyOwner {
        _supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    function removeToken(address token) public onlyOwner {
        _supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function isSupportedToken(address token) public view returns (bool) {
        return _supportedTokens[token];
    }

    event TokensWrapped(address indexed token, string receiver, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
}
