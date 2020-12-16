// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClearingHouse is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) private _supportedTokens;
    mapping(address => uint256) private _nonces;

    constructor(address owner) {
        transferOwnership(owner);
    }

    // Double mapping as token address -> owner -> balance
    event TokensWrapped(address indexed token, string indexed receiver, uint256 indexed amount);

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
        uint256 amount,
        string memory receiver
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

        //use low level call here, send can be a smart contract ???
        tokenERC.transfer(msg.sender, amount);
    }

    // Admin functions for adding and removing tokens from the wrapped token system
    function addToken(address token) public onlyOwner {
        _supportedTokens[token] = true;
    }

    function removeToken(address token) public onlyOwner {
        _supportedTokens[token] = false;
    }

    function isSupportedToken(address token) public view returns (bool) {
        return _supportedTokens[token];
    }
}
