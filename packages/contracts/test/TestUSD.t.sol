// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TestUSD} from "../src/TestUSD.sol";

contract TestUSDTest is Test {
    TestUSD token;
    address user = makeAddr("user");

    function setUp() public {
        vm.warp(1_700_000_000);
        token = new TestUSD();
    }

    function test_faucetCooldown() public {
        vm.prank(user);
        token.faucet();
        assertEq(token.balanceOf(user), 1_000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TestUSD.Cooldown.selector, block.timestamp + 1 hours));
        token.faucet();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(user);
        token.faucet();
        assertEq(token.balanceOf(user), 2_000e6);
    }

    function test_refusesMainnet() public {
        vm.chainId(143);
        vm.expectRevert(TestUSD.MainnetForbidden.selector);
        new TestUSD();
    }
}
