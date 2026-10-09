// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPitchOracle, Outcome} from "./interfaces/IPitchOracle.sol";

/// @title PitchsideRooms
/// @notice Friend rooms with a parimutuel pool on every pitch. Friends are the liquidity; there is no house.
///         POINTS rooms use free, non-transferable chips and settle on the relayer's fast result.
///         STAKES rooms use a stablecoin (AUSD) and settle only once Chainlink CRE confirms the pitch.
/// @dev Every loop is bounded by MAX_PLAYERS. Not audited.
contract PitchsideRooms is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Mode {
        POINTS,
        STAKES
    }

    struct Room {
        address host;
        Mode mode;
        uint16 rakeBps;
        uint32 gamePk;
        uint8 players;
        uint16 openMarkets; // markets with bets that are not settled yet
    }

    /// @dev One storage slot: 96 + 8 + 64 bits.
    struct Bet {
        uint96 amount;
        Outcome outcome;
        uint64 ts;
    }

    uint8 public constant MAX_PLAYERS = 32;
    uint16 public constant STAKES_RAKE_BPS = 400;
    uint16 public constant MAX_BET_BPS = 2_500; // 25% of the stack
    uint256 public constant POINTS_PER_GAME = 1_000;
    /// @notice A market with no final result this long after it locked refunds everyone.
    uint64 public constant STALE_AFTER = 1 hours;

    IPitchOracle public immutable oracle;
    IERC20 public immutable stakeToken;

    uint256 public nextRoomId = 1;
    uint256 public rakeAccrued;

    mapping(uint256 roomId => Room) public rooms;
    mapping(uint256 roomId => mapping(address player => bool)) public isPlayer;
    mapping(uint256 roomId => mapping(address player => uint256)) public chips;
    mapping(uint256 roomId => mapping(address player => uint32)) public pointsMintedFor;
    mapping(uint256 roomId => address[]) internal _members;

    mapping(uint256 roomId => mapping(uint32 gamePk => mapping(uint16 seq => address[]))) internal _bettors;
    mapping(uint256 roomId => mapping(uint32 gamePk => mapping(uint16 seq => mapping(address => Bet)))) internal
        _bets;
    mapping(uint256 roomId => mapping(uint32 gamePk => mapping(uint16 seq => uint256[5]))) internal _pots;
    mapping(uint256 roomId => mapping(uint32 gamePk => mapping(uint16 seq => bool))) public settled;

    event RoomCreated(uint256 indexed roomId, address indexed host, Mode mode, uint32 gamePk);
    event GameSet(uint256 indexed roomId, uint32 gamePk);
    event Joined(uint256 indexed roomId, address indexed player, uint256 credited);
    event BetPlaced(
        uint256 indexed roomId, uint32 indexed gamePk, uint16 indexed seq, address player, Outcome outcome, uint96 amount
    );
    event BetResolved(
        uint256 indexed roomId,
        uint32 indexed gamePk,
        uint16 indexed seq,
        address player,
        Outcome picked,
        uint96 amount,
        uint256 payout,
        bool refunded
    );
    event MarketSettled(
        uint256 indexed roomId, uint32 indexed gamePk, uint16 indexed seq, Outcome outcome, uint256 pot, uint256 rake
    );
    event CashedOut(uint256 indexed roomId, address indexed player, address to, uint256 amount);
    event RakeWithdrawn(address to, uint256 amount);

    error NoRoom(uint256 roomId);
    error NotHost();
    error RoomFull();
    error NotInRoom();
    error MarketsOpen();
    error StakesDisabled();
    error BadAmount();
    error AlreadyCreditedThisGame();
    error BadOutcome();
    error MarketClosed();
    error OverMaxBet(uint256 max);
    error NothingToSettle();
    error AlreadySettled();
    error NotFinal();
    error PointsNotWithdrawable();

    constructor(address owner_, IPitchOracle oracle_, IERC20 stakeToken_) Ownable(owner_) {
        oracle = oracle_;
        stakeToken = stakeToken_;
    }

    // ───────────────────────────── rooms ─────────────────────────────

    function createRoom(Mode mode, uint32 gamePk) external returns (uint256 roomId) {
        if (mode == Mode.STAKES && address(stakeToken) == address(0)) revert StakesDisabled();
        roomId = nextRoomId++;
        rooms[roomId] = Room({
            host: msg.sender,
            mode: mode,
            rakeBps: mode == Mode.STAKES ? STAKES_RAKE_BPS : 0,
            gamePk: gamePk,
            players: 0,
            openMarkets: 0
        });
        emit RoomCreated(roomId, msg.sender, mode, gamePk);
    }

    /// @notice Points the room at the next game. Season standings carry over because chips do.
    function setGame(uint256 roomId, uint32 gamePk) external {
        Room storage r = _room(roomId);
        if (msg.sender != r.host) revert NotHost();
        if (r.openMarkets != 0) revert MarketsOpen();
        r.gamePk = gamePk;
        emit GameSet(roomId, gamePk);
    }

    /// @notice POINTS: `amount` must be 0; credits POINTS_PER_GAME once per game.
    ///         STAKES: deposits `amount` of the stake token. Can be called again to top up.
    function join(uint256 roomId, uint256 amount) external nonReentrant {
        Room storage r = _room(roomId);
        if (!isPlayer[roomId][msg.sender]) {
            if (r.players >= MAX_PLAYERS) revert RoomFull();
            isPlayer[roomId][msg.sender] = true;
            _members[roomId].push(msg.sender);
            r.players++;
        }

        uint256 credited;
        if (r.mode == Mode.POINTS) {
            if (amount != 0) revert BadAmount();
            if (pointsMintedFor[roomId][msg.sender] == r.gamePk) revert AlreadyCreditedThisGame();
            pointsMintedFor[roomId][msg.sender] = r.gamePk;
            credited = POINTS_PER_GAME;
        } else {
            if (amount == 0) revert BadAmount();
            stakeToken.safeTransferFrom(msg.sender, address(this), amount);
            credited = amount;
        }
        chips[roomId][msg.sender] += credited;
        emit Joined(roomId, msg.sender, credited);
    }

    // ───────────────────────────── betting ─────────────────────────────

    /// @notice One bet per player per pitch. Calling again replaces the earlier bet until lock.
    function bet(uint256 roomId, uint16 seq, Outcome outcome, uint96 amount) external {
        Room storage r = _room(roomId);
        if (!isPlayer[roomId][msg.sender]) revert NotInRoom();
        if (outcome == Outcome.NONE || outcome == Outcome.VOID) revert BadOutcome();
        if (amount == 0) revert BadAmount();

        uint32 gamePk = r.gamePk;
        if (!oracle.isOpenMarket(gamePk, seq)) revert MarketClosed();

        Bet storage b = _bets[roomId][gamePk][seq][msg.sender];
        uint256[5] storage pot = _pots[roomId][gamePk][seq];
        uint256 stack = chips[roomId][msg.sender];

        if (b.amount != 0) {
            // replace: return the old stake first
            stack += b.amount;
            pot[uint8(b.outcome)] -= b.amount;
        } else {
            address[] storage list = _bettors[roomId][gamePk][seq];
            list.push(msg.sender);
            if (list.length == 1) r.openMarkets++;
        }

        uint256 maxBet = maxBetFor(stack);
        if (amount > maxBet) revert OverMaxBet(maxBet);

        chips[roomId][msg.sender] = stack - amount;
        pot[uint8(outcome)] += amount;
        _bets[roomId][gamePk][seq][msg.sender] = Bet({amount: amount, outcome: outcome, ts: uint64(block.timestamp)});
        emit BetPlaced(roomId, gamePk, seq, msg.sender, outcome, amount);
    }

    /// @notice Settles one market. Callable by anyone (the relayer runs it as a keeper).
    function settle(uint256 roomId, uint16 seq) external {
        Room storage r = _room(roomId);
        uint32 gamePk = r.gamePk;
        if (settled[roomId][gamePk][seq]) revert AlreadySettled();
        address[] storage list = _bettors[roomId][gamePk][seq];
        uint256 n = list.length; // bounded by MAX_PLAYERS
        if (n == 0) revert NothingToSettle();

        Outcome result = oracle.finalOutcome(gamePk, seq, r.mode == Mode.STAKES);
        if (result == Outcome.NONE) {
            if (block.timestamp <= oracle.marketLockAt(gamePk, seq) + STALE_AFTER) revert NotFinal();
            result = Outcome.VOID;
        }

        Tally memory t;
        t.roomId = roomId;
        t.gamePk = gamePk;
        t.seq = seq;
        t.result = result;
        // A bet stamped at or after the pitch started is late, whatever the reason (courtsiding, lag).
        t.startTs = seq <= oracle.lastSeq(gamePk) ? oracle.pitch(gamePk, seq).startTs : type(uint64).max;

        _tally(t, list);
        t.refundAll = result == Outcome.VOID || t.winning == 0 || _popcount(t.usedMask) < 2;
        t.rake = t.refundAll ? 0 : (t.total * r.rakeBps) / 10_000;
        t.distributable = t.total - t.rake;

        settled[roomId][gamePk][seq] = true;
        r.openMarkets--;

        uint256 paid = _payout(t, list);
        if (!t.refundAll) {
            t.rake += t.distributable - paid; // integer dust goes to rake
            if (r.mode == Mode.STAKES) rakeAccrued += t.rake;
        }
        emit MarketSettled(roomId, gamePk, seq, result, t.total, t.rake);
    }

    struct Tally {
        uint256 roomId;
        uint32 gamePk;
        uint16 seq;
        Outcome result;
        uint64 startTs;
        uint256 total;
        uint256 winning;
        uint8 usedMask;
        bool refundAll;
        uint256 rake;
        uint256 distributable;
    }

    function _tally(Tally memory t, address[] storage list) internal view {
        mapping(address => Bet) storage bets_ = _bets[t.roomId][t.gamePk][t.seq];
        for (uint256 i; i < list.length; ++i) {
            Bet storage b = bets_[list[i]];
            if (b.ts >= t.startTs) continue;
            t.total += b.amount;
            t.usedMask |= uint8(1) << uint8(b.outcome);
            if (b.outcome == t.result) t.winning += b.amount;
        }
    }

    function _payout(Tally memory t, address[] storage list) internal returns (uint256 paid) {
        mapping(address => Bet) storage bets_ = _bets[t.roomId][t.gamePk][t.seq];
        mapping(address => uint256) storage chips_ = chips[t.roomId];
        for (uint256 i; i < list.length; ++i) {
            address player = list[i];
            Bet storage b = bets_[player];
            bool refunded = t.refundAll || b.ts >= t.startTs;
            uint256 payout;
            if (refunded) {
                payout = b.amount;
            } else if (b.outcome == t.result) {
                payout = (uint256(b.amount) * t.distributable) / t.winning;
                paid += payout;
            }
            if (payout != 0) chips_[player] += payout;
            emit BetResolved(t.roomId, t.gamePk, t.seq, player, b.outcome, b.amount, payout, refunded);
        }
    }

    // ───────────────────────────── money out ─────────────────────────────

    /// @notice Sends the whole chip stack to `to` (the app sweeps the room key into the main account).
    function cashOut(uint256 roomId, address to) external nonReentrant {
        Room storage r = _room(roomId);
        if (r.mode != Mode.STAKES) revert PointsNotWithdrawable();
        uint256 amount = chips[roomId][msg.sender];
        if (amount == 0) revert BadAmount();
        chips[roomId][msg.sender] = 0;
        stakeToken.safeTransfer(to, amount);
        emit CashedOut(roomId, msg.sender, to, amount);
    }

    function withdrawRake(address to) external onlyOwner nonReentrant {
        uint256 amount = rakeAccrued;
        rakeAccrued = 0;
        stakeToken.safeTransfer(to, amount);
        emit RakeWithdrawn(to, amount);
    }

    // ───────────────────────────── views ─────────────────────────────

    /// @notice Everyone who ever joined the room, in join order (at most MAX_PLAYERS).
    function members(uint256 roomId) external view returns (address[] memory) {
        return _members[roomId];
    }

    function maxBetFor(uint256 stack) public pure returns (uint256) {
        uint256 max = (stack * MAX_BET_BPS) / 10_000;
        return max == 0 && stack != 0 ? 1 : max;
    }

    function betOf(uint256 roomId, uint32 gamePk, uint16 seq, address player) external view returns (Bet memory) {
        return _bets[roomId][gamePk][seq][player];
    }

    function bettors(uint256 roomId, uint32 gamePk, uint16 seq) external view returns (address[] memory) {
        return _bettors[roomId][gamePk][seq];
    }

    /// @return pot amounts indexed by Outcome (index 0 and VOID unused)
    function potOf(uint256 roomId, uint32 gamePk, uint16 seq) external view returns (uint256[5] memory pot) {
        return _pots[roomId][gamePk][seq];
    }

    // ───────────────────────────── internal ─────────────────────────────

    function _room(uint256 roomId) internal view returns (Room storage r) {
        r = rooms[roomId];
        if (r.host == address(0)) revert NoRoom(roomId);
    }

    function _popcount(uint8 x) internal pure returns (uint8 c) {
        for (; x != 0; x &= x - 1) ++c;
    }
}
