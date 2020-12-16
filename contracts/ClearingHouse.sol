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
}

// No need of this shit
/*
contract MintableToken is IERC20 {
    using SafeMath for uint256;

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name = "MockToken";
    string private _symbol = "MOCK";
    uint8 private _decimals = 18;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    function mint(address to, uint256 amount) public virtual returns (bool success) {
        _totalSupply = _totalSupply.add(amount);
        _balances[to] = _balances[to].add(amount);
        emit Transfer(address(0), to, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }
}
*/
