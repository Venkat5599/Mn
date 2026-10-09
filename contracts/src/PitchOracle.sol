// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IPitchOracle, Outcome, Pitch} from "./interfaces/IPitchOracle.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";

/// @title PitchOracle
/// @notice Two-source pitch results for live MLB games.
///         1. The relayer posts each pitch fast (seconds after the feed updates).
///         2. A Chainlink CRE workflow fetches the same pitch on every DON node and confirms it.
///         A mismatch between the two voids the pitch.
/// @dev Timestamps are unix seconds, floored. Flooring `startTs` is deliberately conservative:
///      any bet whose block time lands in the same second the pitch started is treated as late.
contract PitchOracle is IPitchOracle, IReceiver, Ownable2Step {
    struct Game {
        bool open;
        bool closed;
        uint16 lastSeq;
    }

    /// @notice Seconds after a pitch ends that the next market stays open.
    uint64 public immutable lockDelay;

    address public relayer;
    /// @notice Chainlink KeystoneForwarder (or the CRE simulation signer on testnets without a forwarder).
    address public forwarder;

    mapping(uint32 gamePk => Game) internal _games;
    mapping(uint32 gamePk => mapping(uint16 seq => Pitch)) internal _pitches;

    error NotRelayer();
    error NotForwarder();
    error GameNotOpen(uint32 gamePk);
    error GameAlreadyOpen(uint32 gamePk);
    error OutOfOrder(uint16 expected, uint16 got);
    error BadOutcome();
    error BadTimes();
    error NotReported(uint32 gamePk, uint16 seq);
    error AlreadyConfirmed(uint32 gamePk, uint16 seq);
    error ZeroAddress();

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    constructor(address owner_, address relayer_, address forwarder_, uint64 lockDelay_) Ownable(owner_) {
        if (relayer_ == address(0) || forwarder_ == address(0)) revert ZeroAddress();
        relayer = relayer_;
        forwarder = forwarder_;
        lockDelay = lockDelay_;
        emit RelayerUpdated(relayer_);
        emit ForwarderUpdated(forwarder_);
    }

    // ───────────────────────────── relayer ─────────────────────────────

    /// @notice Opens market #1 for a game. `firstLockAt` should sit before the first pitch.
    function openGame(uint32 gamePk, uint64 firstLockAt) external onlyRelayer {
        Game storage g = _games[gamePk];
        if (g.open || g.closed) revert GameAlreadyOpen(gamePk);
        g.open = true;
        _pitches[gamePk][0].lockAt = firstLockAt;
        emit GameOpened(gamePk, firstLockAt);
    }

    /// @notice Posts pitch `seq`. Strictly sequential, which also opens market `seq + 1`.
    /// @param outcome VOID is allowed for feed calls the mapping does not recognise.
    function reportPitch(uint32 gamePk, uint16 seq, Outcome outcome, uint64 startTs, uint64 endTs)
        external
        onlyRelayer
    {
        Game storage g = _games[gamePk];
        if (!g.open) revert GameNotOpen(gamePk);
        if (seq != g.lastSeq + 1) revert OutOfOrder(g.lastSeq + 1, seq);
        if (outcome == Outcome.NONE) revert BadOutcome();
        if (startTs == 0 || endTs < startTs) revert BadTimes();

        uint64 nextLockAt = endTs + lockDelay;
        _pitches[gamePk][seq] = Pitch({
            startTs: startTs,
            endTs: endTs,
            lockAt: nextLockAt,
            fast: outcome,
            confirmed: Outcome.NONE
        });
        g.lastSeq = seq;
        emit PitchReported(gamePk, seq, outcome, startTs, endTs, nextLockAt);
    }

    /// @notice Final out recorded. The dangling market after the last pitch resolves VOID at once.
    function closeGame(uint32 gamePk) external onlyRelayer {
        Game storage g = _games[gamePk];
        if (!g.open) revert GameNotOpen(gamePk);
        g.open = false;
        g.closed = true;
        emit GameClosed(gamePk, g.lastSeq);
    }

    // ───────────────────────────── CRE ─────────────────────────────

    /// @inheritdoc IReceiver
    /// @dev report = abi.encode(uint32 gamePk, uint16 seq, uint8 outcome)
    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != forwarder) revert NotForwarder();
        (uint32 gamePk, uint16 seq, uint8 raw) = abi.decode(report, (uint32, uint16, uint8));
        if (raw == 0 || raw > uint8(Outcome.VOID)) revert BadOutcome();
        _confirm(gamePk, seq, Outcome(raw));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _confirm(uint32 gamePk, uint16 seq, Outcome reported) internal {
        if (seq == 0 || seq > _games[gamePk].lastSeq) revert NotReported(gamePk, seq);
        Pitch storage p = _pitches[gamePk][seq];
        if (p.confirmed != Outcome.NONE) revert AlreadyConfirmed(gamePk, seq);
        bool matched = reported == p.fast;
        p.confirmed = matched ? reported : Outcome.VOID;
        emit PitchConfirmed(gamePk, seq, reported, matched);
    }

    // ───────────────────────────── owner ─────────────────────────────

    /// @notice Emergency void (broken feed, official scoring change). Only before confirmation.
    function voidPitch(uint32 gamePk, uint16 seq) external onlyOwner {
        if (seq == 0 || seq > _games[gamePk].lastSeq) revert NotReported(gamePk, seq);
        Pitch storage p = _pitches[gamePk][seq];
        if (p.confirmed != Outcome.NONE) revert AlreadyConfirmed(gamePk, seq);
        p.confirmed = Outcome.VOID;
        emit PitchVoided(gamePk, seq);
    }

    function setRelayer(address relayer_) external onlyOwner {
        if (relayer_ == address(0)) revert ZeroAddress();
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert ZeroAddress();
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    // ───────────────────────────── views ─────────────────────────────

    function lastSeq(uint32 gamePk) external view returns (uint16) {
        return _games[gamePk].lastSeq;
    }

    function game(uint32 gamePk) external view returns (Game memory) {
        return _games[gamePk];
    }

    function pitch(uint32 gamePk, uint16 seq) external view returns (Pitch memory) {
        return _pitches[gamePk][seq];
    }

    function marketLockAt(uint32 gamePk, uint16 seq) public view returns (uint64) {
        if (seq == 0) return 0;
        return _pitches[gamePk][seq - 1].lockAt;
    }

    function isOpenMarket(uint32 gamePk, uint16 seq) external view returns (bool) {
        Game storage g = _games[gamePk];
        if (!g.open || seq != g.lastSeq + 1) return false;
        uint64 lockAt = marketLockAt(gamePk, seq);
        return lockAt != 0 && block.timestamp < lockAt;
    }

    function finalOutcome(uint32 gamePk, uint16 seq, bool requireConfirm) external view returns (Outcome) {
        Game storage g = _games[gamePk];
        if (seq == 0) return Outcome.NONE;
        if (seq > g.lastSeq) {
            // The market after the final pitch can never be reported.
            return (g.closed && seq == g.lastSeq + 1) ? Outcome.VOID : Outcome.NONE;
        }
        Pitch storage p = _pitches[gamePk][seq];
        if (p.confirmed != Outcome.NONE) return p.confirmed; // a confirmation or void always wins
        return requireConfirm ? Outcome.NONE : p.fast;
    }
}
