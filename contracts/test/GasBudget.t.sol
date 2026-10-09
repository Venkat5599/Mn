// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console2} from "forge-std/console2.sol";
import {Fixture} from "./utils/Fixture.sol";
import {Outcome} from "../src/interfaces/IPitchOracle.sol";

/// @notice Worst-case gas for the limits in packages/shared/src/chains.ts (Monad bills the LIMIT).
/// In-test calls run warm, so assertions add the 21k intrinsic cost and a margin for cold slots.
contract GasBudgetTest is Fixture {
    uint256 internal constant INTRINSIC = 21_000;
    uint256 internal constant COLD_MARGIN = 30_000;
    /// a full room: 32 stakes players, all on one market, two sides
    function test_gas_settleFullRoom() public {
        uint256 id = _stakesRoom();
        _open(GAME, T0 + 30);
        for (uint256 i; i < 32; ++i) {
            address p = address(uint160(0x5000 + i));
            _joinStakes(id, p, 100e6);
            _bet(id, p, 1, i % 2 == 0 ? Outcome.BALL : Outcome.STRIKE, 10e6);
        }
        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        _confirm(GAME, 1, Outcome.BALL);

        uint256 before = gasleft();
        rooms.settle(id, 1);
        uint256 used = before - gasleft();
        console2.log("settle, 32 bettors:", used);
        // 32 bettors x (bet slot + chips slot) cold adds roughly 32 * 2 * 2.1k on top
        assertLt(used + INTRINSIC + 32 * 2 * 2_100, 1_200_000, "GAS.settle cap too small");
    }

    function test_gas_firstStakesJoinAndBet() public {
        uint256 id = _stakesRoom();
        _open(GAME, T0 + 30);
        address p = makeAddr("fresh");
        ausd.mint(p, 100e6);
        vm.prank(p);
        ausd.approve(address(rooms), 100e6);

        vm.prank(p);
        uint256 before = gasleft();
        rooms.join(id, 100e6);
        uint256 joinGas = before - gasleft();

        vm.prank(p);
        before = gasleft();
        rooms.bet(id, 1, Outcome.BALL, 10e6);
        uint256 betGas = before - gasleft();

        console2.log("join (first, stakes):", joinGas);
        console2.log("bet (first in market):", betGas);
        assertLt(joinGas + INTRINSIC + COLD_MARGIN, 220_000, "GAS.join too small");
        assertLt(betGas + INTRINSIC + COLD_MARGIN, 200_000, "GAS.bet too small");
    }
}
