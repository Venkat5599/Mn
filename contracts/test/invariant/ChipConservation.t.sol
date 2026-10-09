// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PitchOracle} from "../../src/PitchOracle.sol";
import {PitchsideRooms} from "../../src/PitchsideRooms.sol";
import {MockAUSD} from "../../src/mocks/MockAUSD.sol";
import {Outcome} from "../../src/interfaces/IPitchOracle.sol";

/// @dev Drives one STAKES room through random joins, bets, reports, confirmations, settles and cash-outs.
contract RoomHandler is Test {
    uint32 internal constant GAME = 849_831;

    PitchOracle public oracle;
    PitchsideRooms public rooms;
    MockAUSD public ausd;
    address public relayer;
    address public forwarder;
    uint256 public roomId;
    address[] public players;

    uint16 public seq = 1; // currently open market
    uint256 public ghostOpenPot; // chips sitting in unsettled pots
    uint16[] internal _unsettled;

    constructor(PitchOracle o, PitchsideRooms r, MockAUSD t, address rel, address fwd, uint256 id) {
        oracle = o;
        rooms = r;
        ausd = t;
        relayer = rel;
        forwarder = fwd;
        roomId = id;
        for (uint256 i; i < 5; ++i) {
            players.push(address(uint160(0xA000 + i)));
        }
    }

    function join(uint256 who, uint256 amount) external {
        address p = players[who % players.length];
        amount = bound(amount, 1, 1_000e6);
        ausd.mint(p, amount);
        vm.startPrank(p);
        ausd.approve(address(rooms), amount);
        rooms.join(roomId, amount);
        vm.stopPrank();
    }

    function bet(uint256 who, uint8 outcomeRaw, uint96 amount) external {
        address p = players[who % players.length];
        if (!rooms.isPlayer(roomId, p) || !oracle.isOpenMarket(GAME, seq)) return;
        uint256 old = rooms.betOf(roomId, GAME, seq, p).amount;
        uint256 stack = rooms.chips(roomId, p) + old;
        uint256 max = rooms.maxBetFor(stack);
        if (max == 0) return;
        amount = uint96(bound(amount, 1, max));
        Outcome o = Outcome(bound(outcomeRaw, 1, 4));
        bool first = rooms.bettors(roomId, GAME, seq).length == 0;
        vm.prank(p);
        rooms.bet(roomId, seq, o, amount);
        ghostOpenPot = ghostOpenPot + amount - old;
        if (first) _unsettled.push(seq);
    }

    function pitch(uint8 outcomeRaw, bool agree, uint8 startOffset) external {
        Outcome o = Outcome(bound(outcomeRaw, 1, 5));
        uint64 lockAt = oracle.marketLockAt(GAME, seq);
        uint64 start = lockAt - uint64(bound(startOffset, 0, 10)); // sometimes before lock: late bets
        if (start <= block.timestamp - 20) start = uint64(block.timestamp);
        vm.warp(lockAt);
        vm.prank(relayer);
        oracle.reportPitch(GAME, seq, o, start, start + 2);
        Outcome confirmed = agree ? o : (o == Outcome.BALL ? Outcome.STRIKE : Outcome.BALL);
        vm.prank(forwarder);
        oracle.onReport("", abi.encode(GAME, seq, uint8(confirmed)));
        seq++;
    }

    function settleAll() external {
        while (_unsettled.length != 0) {
            uint16 s = _unsettled[_unsettled.length - 1];
            if (s >= seq) return; // not reported yet
            _unsettled.pop();
            uint256[5] memory pot = rooms.potOf(roomId, GAME, s);
            rooms.settle(roomId, s);
            ghostOpenPot -= pot[1] + pot[2] + pot[3] + pot[4];
        }
    }

    function cashOut(uint256 who) external {
        address p = players[who % players.length];
        if (rooms.chips(roomId, p) == 0) return;
        vm.prank(p);
        rooms.cashOut(roomId, p);
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }
}

contract ChipConservationInvariant is Test {
    PitchOracle internal oracle;
    PitchsideRooms internal rooms;
    MockAUSD internal ausd;
    RoomHandler internal handler;
    uint256 internal roomId;

    function setUp() public {
        vm.warp(1_760_000_000);
        address relayer = makeAddr("relayer");
        address forwarder = makeAddr("forwarder");
        ausd = new MockAUSD();
        oracle = new PitchOracle(address(this), relayer, forwarder, 8);
        rooms = new PitchsideRooms(address(this), oracle, IERC20(address(ausd)));
        roomId = rooms.createRoom(PitchsideRooms.Mode.STAKES, 849_831);
        vm.prank(relayer);
        oracle.openGame(849_831, uint64(block.timestamp + 30));
        handler = new RoomHandler(oracle, rooms, ausd, relayer, forwarder, roomId);
        targetContract(address(handler));
    }

    /// @notice Every token the contract holds is a chip, sits in an open pot, or is accrued rake.
    function invariant_tokensBackEveryChip() public view {
        uint256 sum;
        for (uint256 i; i < handler.playerCount(); ++i) {
            sum += rooms.chips(roomId, handler.players(i));
        }
        assertEq(ausd.balanceOf(address(rooms)), sum + handler.ghostOpenPot() + rooms.rakeAccrued());
    }
}
