// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClearingHouse is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) private _supportedTokens;
    mapping(address => uint256) private _nonces;

    // TESTED
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

    // TESTED
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
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public onlyValidNonce(nonce) {
        _nonces[msg.sender] = nonce;
        bytes32 digest = keccak256(abi.encodePacked(token, amount, nonce, msg.sender));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner(), "ClearingHouse: Invalid Signature!");
        IERC20 tokenERC = IERC20(token);
        tokenERC.transfer(msg.sender, amount);
    }

    // Admin functions for adding and removing tokens from the wrapped token system
    // TESTED
    function addToken(address token) public onlyOwner {
        _supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    //TESTED
    function removeToken(address token) public onlyOwner {
        _supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    //TEST
    function isSupportedToken(address token) public view returns (bool) {
        return _supportedTokens[token];
    }

    // Double mapping as token address -> owner -> balance
    event TokensWrapped(address indexed token, string receiver, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
}
