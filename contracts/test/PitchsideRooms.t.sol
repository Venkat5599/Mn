// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Fixture} from "./utils/Fixture.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PitchsideRooms} from "../src/PitchsideRooms.sol";
import {Outcome} from "../src/interfaces/IPitchOracle.sol";

contract PitchsideRoomsTest is Fixture {
    uint256 internal constant USD = 1e6;

    // ───────────── rooms + joining ─────────────

    function test_createRoom_setsRake() public {
        uint256 p = _pointsRoom();
        uint256 s = _stakesRoom();
        (,, uint16 pr,,,) = rooms.rooms(p);
        (,, uint16 sr,,,) = rooms.rooms(s);
        assertEq(pr, 0);
        assertEq(sr, 400);
        assertEq(s, p + 1);
    }

    function test_createStakes_withoutTokenReverts() public {
        PitchsideRooms noToken = new PitchsideRooms(owner, oracle, IERC20(address(0)));
        vm.expectRevert(PitchsideRooms.StakesDisabled.selector);
        noToken.createRoom(PitchsideRooms.Mode.STAKES, GAME);
    }

    function test_joinPoints_oncePerGame() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        assertEq(rooms.chips(id, alice), 1_000);
        assertEq(rooms.members(id).length, 1);

        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.AlreadyCreditedThisGame.selector);
        rooms.join(id, 0);

        vm.prank(host);
        rooms.setGame(id, NEXT_GAME);
        _joinPoints(id, alice);
        assertEq(rooms.chips(id, alice), 2_000, "season stack carries over");
        assertEq(rooms.members(id).length, 1, "rejoining does not duplicate the member");
    }

    function test_joinPoints_rejectsDeposit() public {
        uint256 id = _pointsRoom();
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.BadAmount.selector);
        rooms.join(id, 5);
    }

    function test_joinStakes_pullsTokens() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 10 * USD);
        assertEq(rooms.chips(id, alice), 10 * USD);
        assertEq(ausd.balanceOf(address(rooms)), 10 * USD);
    }

    function test_join_maxPlayers() public {
        uint256 id = _pointsRoom();
        for (uint256 i; i < 32; ++i) {
            _joinPoints(id, address(uint160(0x1000 + i)));
        }
        vm.prank(address(0xBEEF));
        vm.expectRevert(PitchsideRooms.RoomFull.selector);
        rooms.join(id, 0);
    }

    function test_join_noRoomReverts() public {
        vm.expectRevert(abi.encodeWithSelector(PitchsideRooms.NoRoom.selector, 99));
        rooms.join(99, 0);
    }

    // ───────────── betting rules ─────────────

    function test_bet_requiresOpenMarket() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.MarketClosed.selector);
        rooms.bet(id, 1, Outcome.BALL, 10); // game not opened
    }

    function test_bet_lockBoundary() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);

        vm.warp(T0 + 29);
        _bet(id, alice, 1, Outcome.BALL, 10); // last valid second

        vm.warp(T0 + 30);
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.MarketClosed.selector);
        rooms.bet(id, 1, Outcome.BALL, 10);
    }

    function test_bet_cannotBetFutureOrPastMarket() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.MarketClosed.selector);
        rooms.bet(id, 2, Outcome.BALL, 10);

        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.MarketClosed.selector);
        rooms.bet(id, 1, Outcome.BALL, 10);
    }

    function test_bet_maxIs25PercentOfStack() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PitchsideRooms.OverMaxBet.selector, 250));
        rooms.bet(id, 1, Outcome.BALL, 251);
        _bet(id, alice, 1, Outcome.BALL, 250);
    }

    function test_bet_rejectsNoneVoidZeroAndOutsiders() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);
        vm.startPrank(alice);
        vm.expectRevert(PitchsideRooms.BadOutcome.selector);
        rooms.bet(id, 1, Outcome.NONE, 10);
        vm.expectRevert(PitchsideRooms.BadOutcome.selector);
        rooms.bet(id, 1, Outcome.VOID, 10);
        vm.expectRevert(PitchsideRooms.BadAmount.selector);
        rooms.bet(id, 1, Outcome.BALL, 0);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(PitchsideRooms.NotInRoom.selector);
        rooms.bet(id, 1, Outcome.BALL, 10);
    }

    function test_bet_replaceDoesNotDuplicateBettor() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _open(GAME, T0 + 30);

        _bet(id, alice, 1, Outcome.BALL, 100);
        _bet(id, alice, 1, Outcome.STRIKE, 200);
        _bet(id, bob, 1, Outcome.BALL, 100);

        assertEq(rooms.bettors(id, GAME, 1).length, 2);
        assertEq(rooms.chips(id, alice), 800);
        uint256[5] memory pot = rooms.potOf(id, GAME, 1);
        assertEq(pot[uint8(Outcome.BALL)], 100);
        assertEq(pot[uint8(Outcome.STRIKE)], 200);

        // replace budget counts the returned stake: 25% of (800 + 200)
        _bet(id, alice, 1, Outcome.FOUL, 250);
        assertEq(rooms.chips(id, alice), 750);

        _report(GAME, 1, Outcome.FOUL, T0 + 31, T0 + 32);
        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 750 + 350, "alice paid exactly once");
        assertEq(rooms.chips(id, bob), 900);
    }

    // ───────────── settlement ─────────────

    function test_settle_pointsParimutuel() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _joinPoints(id, carol);
        _open(GAME, T0 + 30);

        _bet(id, alice, 1, Outcome.STRIKE, 100);
        _bet(id, bob, 1, Outcome.STRIKE, 50);
        _bet(id, carol, 1, Outcome.BALL, 150);
        _report(GAME, 1, Outcome.STRIKE, T0 + 31, T0 + 32);

        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 900 + 200); // 100 * 300 / 150
        assertEq(rooms.chips(id, bob), 950 + 100);
        assertEq(rooms.chips(id, carol), 850);
        assertTrue(rooms.settled(id, GAME, 1));
    }

    function test_settle_twiceReverts() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.BALL, 10);
        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        rooms.settle(id, 1);
        vm.expectRevert(PitchsideRooms.AlreadySettled.selector);
        rooms.settle(id, 1);
    }

    function test_settle_emptyMarketReverts() public {
        uint256 id = _pointsRoom();
        vm.expectRevert(PitchsideRooms.NothingToSettle.selector);
        rooms.settle(id, 1);
    }

    function test_settle_stakesWaitsForCreThenTakesRake() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 20 * USD);
        _joinStakes(id, bob, 20 * USD);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.IN_PLAY, uint96(5 * USD));
        _bet(id, bob, 1, Outcome.FOUL, uint96(5 * USD));
        _report(GAME, 1, Outcome.IN_PLAY, T0 + 31, T0 + 32);

        vm.expectRevert(PitchsideRooms.NotFinal.selector);
        rooms.settle(id, 1);

        _confirm(GAME, 1, Outcome.IN_PLAY);
        rooms.settle(id, 1);

        // pot 10, rake 4% = 0.4, alice gets 9.6
        assertEq(rooms.chips(id, alice), 15 * USD + 9_600_000);
        assertEq(rooms.chips(id, bob), 15 * USD);
        assertEq(rooms.rakeAccrued(), 400_000);
    }

    function test_settle_mismatchRefundsStakes() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 20 * USD);
        _joinStakes(id, bob, 20 * USD);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.BALL, uint96(5 * USD));
        _bet(id, bob, 1, Outcome.STRIKE, uint96(5 * USD));
        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        _confirm(GAME, 1, Outcome.STRIKE); // sources disagree

        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 20 * USD);
        assertEq(rooms.chips(id, bob), 20 * USD);
        assertEq(rooms.rakeAccrued(), 0);
    }

    function test_settle_lateBetRefundedOthersPaid() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _joinPoints(id, carol);
        _open(GAME, T0 + 30);

        vm.warp(T0 + 10);
        _bet(id, alice, 1, Outcome.STRIKE, 100);
        _bet(id, bob, 1, Outcome.BALL, 100);
        vm.warp(T0 + 25); // pitch actually started at T0 + 25, before the lock
        _bet(id, carol, 1, Outcome.STRIKE, 200);
        _report(GAME, 1, Outcome.STRIKE, T0 + 25, T0 + 27);

        rooms.settle(id, 1);
        assertEq(rooms.chips(id, carol), 1_000, "late bet refunded in full");
        assertEq(rooms.chips(id, alice), 900 + 200, "alice wins the on-time pot only");
        assertEq(rooms.chips(id, bob), 900);
    }

    function test_settle_noWinnersRefundsAll() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.STRIKE, 100);
        _bet(id, bob, 1, Outcome.BALL, 100);
        _report(GAME, 1, Outcome.FOUL, T0 + 31, T0 + 32);
        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 1_000);
        assertEq(rooms.chips(id, bob), 1_000);
    }

    function test_settle_oneSidedRefundsAll() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 20 * USD);
        _joinStakes(id, bob, 20 * USD);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.BALL, uint96(5 * USD));
        _bet(id, bob, 1, Outcome.BALL, uint96(5 * USD));
        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        _confirm(GAME, 1, Outcome.BALL);
        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 20 * USD);
        assertEq(rooms.rakeAccrued(), 0, "no rake on a refunded pot");
    }

    function test_settle_voidFeedCallRefunds() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.STRIKE, 100);
        _bet(id, bob, 1, Outcome.BALL, 100);
        _report(GAME, 1, Outcome.VOID, T0 + 31, T0 + 32);
        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 1_000);
    }

    function test_settle_staleMarketRefundsAfterTimeout() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.STRIKE, 100);
        _bet(id, bob, 1, Outcome.BALL, 100);

        vm.warp(T0 + 30 + 1 hours);
        vm.expectRevert(PitchsideRooms.NotFinal.selector);
        rooms.settle(id, 1);

        vm.warp(T0 + 30 + 1 hours + 1);
        rooms.settle(id, 1);
        assertEq(rooms.chips(id, alice), 1_000);
    }

    function test_settle_closedGameRefundsDanglingMarket() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _joinPoints(id, bob);
        _open(GAME, T0 + 30);
        _report(GAME, 1, Outcome.IN_PLAY, T0 + 31, T0 + 32);
        _bet(id, alice, 2, Outcome.STRIKE, 100);
        _bet(id, bob, 2, Outcome.BALL, 100);
        vm.prank(relayer);
        oracle.closeGame(GAME);
        rooms.settle(id, 2);
        assertEq(rooms.chips(id, alice), 1_000);
    }

    function test_settle_dustGoesToRake() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 100);
        _joinStakes(id, bob, 100);
        _joinStakes(id, carol, 100);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.BALL, 7);
        _bet(id, bob, 1, Outcome.BALL, 11);
        _bet(id, carol, 1, Outcome.STRIKE, 13);
        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        _confirm(GAME, 1, Outcome.BALL);
        rooms.settle(id, 1);

        uint256 sum = rooms.chips(id, alice) + rooms.chips(id, bob) + rooms.chips(id, carol);
        assertEq(sum + rooms.rakeAccrued(), 300, "nothing created or lost");
    }

    // ───────────── game switching + money out ─────────────

    function test_setGame_blockedWhileMarketsOpen() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        _open(GAME, T0 + 30);
        _bet(id, alice, 1, Outcome.BALL, 10);

        vm.prank(host);
        vm.expectRevert(PitchsideRooms.MarketsOpen.selector);
        rooms.setGame(id, NEXT_GAME);

        _report(GAME, 1, Outcome.BALL, T0 + 31, T0 + 32);
        rooms.settle(id, 1);
        vm.prank(host);
        rooms.setGame(id, NEXT_GAME);
    }

    function test_setGame_onlyHost() public {
        uint256 id = _pointsRoom();
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.NotHost.selector);
        rooms.setGame(id, NEXT_GAME);
    }

    function test_cashOut_stakesToMainAccount() public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 10 * USD);
        address mainAccount = makeAddr("aliceMain");
        vm.prank(alice);
        rooms.cashOut(id, mainAccount);
        assertEq(ausd.balanceOf(mainAccount), 10 * USD);
        assertEq(rooms.chips(id, alice), 0);

        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.BadAmount.selector);
        rooms.cashOut(id, mainAccount);
    }

    function test_cashOut_pointsReverts() public {
        uint256 id = _pointsRoom();
        _joinPoints(id, alice);
        vm.prank(alice);
        vm.expectRevert(PitchsideRooms.PointsNotWithdrawable.selector);
        rooms.cashOut(id, alice);
    }

    function test_withdrawRake_ownerOnly() public {
        test_settle_stakesWaitsForCreThenTakesRake();
        vm.expectRevert();
        rooms.withdrawRake(alice);
        vm.prank(owner);
        rooms.withdrawRake(owner);
        assertEq(ausd.balanceOf(owner), 400_000);
        assertEq(rooms.rakeAccrued(), 0);
    }

    // ───────────── fuzz ─────────────

    function testFuzz_settle_conservesChips(uint96 a, uint96 b, uint96 c, uint8 resultRaw) public {
        uint256 id = _stakesRoom();
        _joinStakes(id, alice, 1_000 * USD);
        _joinStakes(id, bob, 1_000 * USD);
        _joinStakes(id, carol, 1_000 * USD);
        _open(GAME, T0 + 30);

        a = uint96(bound(a, 1, 250 * USD));
        b = uint96(bound(b, 1, 250 * USD));
        c = uint96(bound(c, 1, 250 * USD));
        Outcome result = Outcome(bound(resultRaw, 1, 5));

        _bet(id, alice, 1, Outcome.BALL, a);
        _bet(id, bob, 1, Outcome.STRIKE, b);
        _bet(id, carol, 1, Outcome.BALL, c);
        _report(GAME, 1, result, T0 + 31, T0 + 32);
        _confirm(GAME, 1, result);
        rooms.settle(id, 1);

        uint256 sum = rooms.chips(id, alice) + rooms.chips(id, bob) + rooms.chips(id, carol);
        assertEq(sum + rooms.rakeAccrued(), 3_000 * USD);
        assertLe(rooms.rakeAccrued(), ((uint256(a) + b + c) * 400) / 10_000 + 2);
    }

    function testFuzz_maxBetFor_neverExceedsStack(uint256 stack) public view {
        stack = bound(stack, 0, type(uint128).max);
        uint256 m = rooms.maxBetFor(stack);
        assertLe(m, stack);
        if (stack >= 4) assertEq(m, stack / 4);
    }
}
