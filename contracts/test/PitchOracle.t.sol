// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {PitchOracle} from "../src/PitchOracle.sol";
import {IReceiver} from "../src/interfaces/IReceiver.sol";
import {Outcome, Pitch} from "../src/interfaces/IPitchOracle.sol";

contract PitchOracleTest is Fixture {
    function test_openGame_onlyRelayer() public {
        vm.expectRevert(PitchOracle.NotRelayer.selector);
        oracle.openGame(GAME, T0 + 30);
    }

    function test_openGame_twiceReverts() public {
        _open(GAME, T0 + 30);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PitchOracle.GameAlreadyOpen.selector, GAME));
        oracle.openGame(GAME, T0 + 30);
    }

    function test_firstMarket_opensAndLocks() public {
        _open(GAME, T0 + 30);
        assertTrue(oracle.isOpenMarket(GAME, 1));
        assertFalse(oracle.isOpenMarket(GAME, 2));
        vm.warp(T0 + 30);
        assertFalse(oracle.isOpenMarket(GAME, 1), "locks exactly at lockAt");
    }

    function test_report_setsNextLock() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.BALL, T0 + 40, T0 + 41);
        Pitch memory p = oracle.pitch(GAME, 1);
        assertEq(uint8(p.fast), uint8(Outcome.BALL));
        assertEq(p.lockAt, T0 + 41 + LOCK_DELAY);
        assertEq(oracle.marketLockAt(GAME, 2), T0 + 41 + LOCK_DELAY);
        assertEq(oracle.lastSeq(GAME), 1);
    }

    function test_report_outOfOrderReverts() public {
        _open(GAME, T0 + 30);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PitchOracle.OutOfOrder.selector, 1, 2));
        oracle.reportPitch(GAME, 2, Outcome.BALL, T0 + 40, T0 + 41);
    }

    function test_report_rejectsNoneAndBadTimes() public {
        _open(GAME, T0 + 30);
        vm.startPrank(relayer);
        vm.expectRevert(PitchOracle.BadOutcome.selector);
        oracle.reportPitch(GAME, 1, Outcome.NONE, T0 + 40, T0 + 41);
        vm.expectRevert(PitchOracle.BadTimes.selector);
        oracle.reportPitch(GAME, 1, Outcome.BALL, T0 + 42, T0 + 41);
        vm.stopPrank();
    }

    function test_report_requiresOpenGame() public {
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PitchOracle.GameNotOpen.selector, GAME));
        oracle.reportPitch(GAME, 1, Outcome.BALL, T0 + 40, T0 + 41);
    }

    function test_finalOutcome_fastVsConfirmed() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        assertEq(uint8(oracle.finalOutcome(GAME, 1, false)), uint8(Outcome.STRIKE));
        assertEq(uint8(oracle.finalOutcome(GAME, 1, true)), uint8(Outcome.NONE), "stakes wait for CRE");
        _confirm(GAME, 1, Outcome.STRIKE);
        assertEq(uint8(oracle.finalOutcome(GAME, 1, true)), uint8(Outcome.STRIKE));
    }

    function test_confirm_mismatchVoidsBothModes() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        _confirm(GAME, 1, Outcome.BALL);
        assertEq(uint8(oracle.finalOutcome(GAME, 1, true)), uint8(Outcome.VOID));
        assertEq(uint8(oracle.finalOutcome(GAME, 1, false)), uint8(Outcome.VOID));
    }

    function test_confirm_onlyForwarder() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        vm.expectRevert(PitchOracle.NotForwarder.selector);
        oracle.onReport("", abi.encode(GAME, uint16(1), uint8(Outcome.STRIKE)));
    }

    function test_confirm_unreportedAndTwiceRevert() public {
        _open(GAME, T0 + 30);
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(PitchOracle.NotReported.selector, GAME, 1));
        oracle.onReport("", abi.encode(GAME, uint16(1), uint8(Outcome.STRIKE)));

        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        _confirm(GAME, 1, Outcome.STRIKE);
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(PitchOracle.AlreadyConfirmed.selector, GAME, 1));
        oracle.onReport("", abi.encode(GAME, uint16(1), uint8(Outcome.STRIKE)));
    }

    function test_confirm_rejectsOutOfRangeOutcome() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        vm.prank(forwarder);
        vm.expectRevert(PitchOracle.BadOutcome.selector);
        oracle.onReport("", abi.encode(GAME, uint16(1), uint8(9)));
    }

    function test_voidPitch_ownerOnly() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.STRIKE, T0 + 40, T0 + 41);
        vm.expectRevert();
        oracle.voidPitch(GAME, 1);
        vm.prank(owner);
        oracle.voidPitch(GAME, 1);
        assertEq(uint8(oracle.finalOutcome(GAME, 1, false)), uint8(Outcome.VOID));
    }

    function test_closeGame_voidsDanglingMarket() public {
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.IN_PLAY, T0 + 40, T0 + 41);
        vm.prank(relayer);
        oracle.closeGame(GAME);
        assertEq(uint8(oracle.finalOutcome(GAME, 2, false)), uint8(Outcome.VOID));
        assertEq(uint8(oracle.finalOutcome(GAME, 3, false)), uint8(Outcome.NONE));
        assertFalse(oracle.isOpenMarket(GAME, 2));
    }

    function test_supportsReceiverInterface() public view {
        assertTrue(oracle.supportsInterface(type(IReceiver).interfaceId));
    }

    function test_setters_zeroAddressReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(PitchOracle.ZeroAddress.selector);
        oracle.setRelayer(address(0));
        vm.expectRevert(PitchOracle.ZeroAddress.selector);
        oracle.setForwarder(address(0));
        vm.stopPrank();
    }
}
