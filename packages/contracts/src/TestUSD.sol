// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestUSD
/// @notice Testnet-only stake token with a rate-limited faucet. It has no value and is not a stablecoin.
///         Monad testnet had no USDC deployment when HYPERHEDGE launched, so the market settles in this.
contract TestUSD is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastDrip;

    error Cooldown(uint256 availableAt);
    error MainnetForbidden();

    constructor() ERC20("HYPERHEDGE Test USD", "hhUSD") {
        if (block.chainid == 1 || block.chainid == 143) revert MainnetForbidden();
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint256 next = lastDrip[msg.sender] + FAUCET_COOLDOWN;
        if (lastDrip[msg.sender] != 0 && block.timestamp < next) revert Cooldown(next);
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
