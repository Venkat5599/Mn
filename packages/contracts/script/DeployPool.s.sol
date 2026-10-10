// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PriceProtectionPool} from "../src/PriceProtectionPool.sol";

/// @notice Deploys the MON/USD price-protection pool against the existing hhUSD token and the HYPERHEDGE
///         oracle signers (2 of 3), and seeds it with initial liquidity.
/// env: DEPLOYER_PRIVATE_KEY, SIGNER_{1,2,3}_ADDRESS, POOL_TOKEN, POOL_SEED (6-decimal amount)
contract DeployPool is Script {
    bytes32 constant MON_USD = keccak256("MON/USD");

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address token = vm.envAddress("POOL_TOKEN");
        uint256 seed = vm.envUint("POOL_SEED");
        address[] memory signers = new address[](3);
        signers[0] = vm.envAddress("SIGNER_1_ADDRESS");
        signers[1] = vm.envAddress("SIGNER_2_ADDRESS");
        signers[2] = vm.envAddress("SIGNER_3_ADDRESS");

        vm.startBroadcast(pk);
        // 700 bps assumed daily volatility for MON: a disclosed curve parameter, not a forecast
        PriceProtectionPool pool = new PriceProtectionPool(vm.addr(pk), IERC20(token), MON_USD, signers, 2, 700);
        if (seed > 0) {
            IERC20(token).approve(address(pool), seed);
            pool.deposit(seed);
        }
        vm.stopBroadcast();
        console.log("PriceProtectionPool", address(pool));
    }
}
