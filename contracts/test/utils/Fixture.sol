// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PitchOracle} from "../../src/PitchOracle.sol";
import {PitchsideRooms} from "../../src/PitchsideRooms.sol";
import {MockAUSD} from "../../src/mocks/MockAUSD.sol";
import {Outcome} from "../../src/interfaces/IPitchOracle.sol";

/// @dev Shared deployment + helpers. Times are relative to T0 so tests read like a game log.
abstract contract Fixture is Test {
    uint64 internal constant LOCK_DELAY = 8;
    uint64 internal constant T0 = 1_760_000_000;
    uint32 internal constant GAME = 849_831;
    uint32 internal constant NEXT_GAME = 849_840;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal forwarder = makeAddr("forwarder");
    address internal host = makeAddr("host");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    PitchOracle internal oracle;
    PitchsideRooms internal rooms;
    MockAUSD internal ausd;

    function setUp() public virtual {
        vm.warp(T0);
        ausd = new MockAUSD();
        oracle = new PitchOracle(owner, relayer, forwarder, LOCK_DELAY);
        rooms = new PitchsideRooms(owner, oracle, IERC20(address(ausd)));
    }

    // ── oracle helpers ──

    function _open(uint32 gamePk, uint64 firstLockAt) internal {
        vm.prank(relayer);
        oracle.openGame(gamePk, firstLockAt);
    }

    function _report(uint32 gamePk, uint16 seq, Outcome o, uint64 startTs, uint64 endTs) internal {
        vm.prank(relayer);
        oracle.reportPitch(gamePk, seq, o, startTs, endTs);
    }

    function _confirm(uint32 gamePk, uint16 seq, Outcome o) internal {
        vm.prank(forwarder);
        oracle.onReport("", abi.encode(gamePk, seq, uint8(o)));
    }

    // ── room helpers ──

    function _pointsRoom() internal returns (uint256 id) {
        vm.prank(host);
        id = rooms.createRoom(PitchsideRooms.Mode.POINTS, GAME);
    }

    function _stakesRoom() internal returns (uint256 id) {
        vm.prank(host);
        id = rooms.createRoom(PitchsideRooms.Mode.STAKES, GAME);
    }

    function _joinPoints(uint256 id, address who) internal {
        vm.prank(who);
        rooms.join(id, 0);
    }

    function _joinStakes(uint256 id, address who, uint256 amount) internal {
        ausd.mint(who, amount);
        vm.startPrank(who);
        ausd.approve(address(rooms), amount);
        rooms.join(id, amount);
        vm.stopPrank();
    }

    function _bet(uint256 id, address who, uint16 seq, Outcome o, uint96 amount) internal {
        vm.prank(who);
        rooms.bet(id, seq, o, amount);
    }
}
