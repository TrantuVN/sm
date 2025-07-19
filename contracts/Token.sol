// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18; // 1,000,000 SCN

    constructor() ERC20("Scoin", "SCN") {
        _mint(msg.sender, MAX_SUPPLY);
        transferOwnership(msg.sender);
    }

    // Chỉ owner được phép mint thêm (không vượt MAX_SUPPLY)
    function safeMint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
}
