// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Result of a single pitch. Order is part of the ABI: never reorder.
/// NONE    = not reported yet
/// VOID    = unmapped feed call, relayer/CRE mismatch, or game closed before this pitch
enum Outcome {
    NONE,
    BALL,
    STRIKE,
    FOUL,
    IN_PLAY,
    VOID
}

/// @notice One pitch as the oracle knows it. Packs into a single storage slot (3 x 64 + 2 x 8 bits).
/// @dev `lockAt` stored on pitch `n` is the betting close for market `n + 1`.
struct Pitch {
    uint64 startTs;
    uint64 endTs;
    uint64 lockAt;
    Outcome fast;
    Outcome confirmed;
}

interface IPitchOracle {
    event GameOpened(uint32 indexed gamePk, uint64 firstLockAt);
    event GameClosed(uint32 indexed gamePk, uint16 lastSeq);
    event PitchReported(
        uint32 indexed gamePk, uint16 indexed seq, Outcome outcome, uint64 startTs, uint64 endTs, uint64 nextLockAt
    );
    event PitchConfirmed(uint32 indexed gamePk, uint16 indexed seq, Outcome reported, bool matched);
    event PitchVoided(uint32 indexed gamePk, uint16 indexed seq);
    event RelayerUpdated(address relayer);
    event ForwarderUpdated(address forwarder);

    function lockDelay() external view returns (uint64);
    function lastSeq(uint32 gamePk) external view returns (uint16);
    function pitch(uint32 gamePk, uint16 seq) external view returns (Pitch memory);

    /// @notice Betting close for market `seq` (0 if the market has not been opened yet).
    function marketLockAt(uint32 gamePk, uint16 seq) external view returns (uint64);

    /// @notice True while market `seq` accepts bets.
    function isOpenMarket(uint32 gamePk, uint16 seq) external view returns (bool);

    /// @notice Outcome a room should settle on. NONE means "not final yet".
    /// @param requireConfirm true for real-money rooms: only a CRE-confirmed result counts.
    function finalOutcome(uint32 gamePk, uint16 seq, bool requireConfirm) external view returns (Outcome);
}
