import { encodeAbiParameters, type Hex } from "viem";
import { flattenPitches, type MlbFeed } from "./feed";
import { Outcome } from "./outcome";

export interface ConfirmRequest {
  gamePk: number;
  seq: number;
  playId: string;
}

export interface ConfirmResult {
  gamePk: number;
  seq: number;
  outcome: Outcome;
  reason: "ok" | "playId-missing" | "seq-mismatch";
}

/**
 * The independent check each Chainlink DON node runs. It does NOT trust the relayer's seq:
 * it finds the pitch by playId in its own copy of the feed and votes VOID if the position differs
 * or the pitch is gone. PitchOracle then voids on any disagreement with the fast report.
 */
export function resolveConfirmation(feed: MlbFeed, req: ConfirmRequest): ConfirmResult {
  const pitches = flattenPitches(feed);
  const idx = pitches.findIndex((p) => p.playId === req.playId);
  if (idx === -1) return { gamePk: req.gamePk, seq: req.seq, outcome: Outcome.VOID, reason: "playId-missing" };
  const p = pitches[idx]!;
  if (p.seq !== req.seq) return { gamePk: req.gamePk, seq: req.seq, outcome: Outcome.VOID, reason: "seq-mismatch" };
  return { gamePk: req.gamePk, seq: req.seq, outcome: p.outcome, reason: "ok" };
}

/**
 * Cron-sweep fallback when no playId is at hand: confirm by position in the DON's own copy of the feed.
 * A renumbered feed still ends in VOID on chain, because the position's outcome then rarely matches.
 */
export function resolveBySeq(feed: MlbFeed, gamePk: number, seq: number): ConfirmResult {
  const p = flattenPitches(feed)[seq - 1];
  if (!p) return { gamePk, seq, outcome: Outcome.VOID, reason: "playId-missing" };
  return { gamePk, seq, outcome: p.outcome, reason: "ok" };
}

/** Report bytes PitchOracle.onReport decodes: abi.encode(uint32 gamePk, uint16 seq, uint8 outcome). */
export function encodeConfirmReport(r: Pick<ConfirmResult, "gamePk" | "seq" | "outcome">): Hex {
  return encodeAbiParameters(
    [{ type: "uint32" }, { type: "uint16" }, { type: "uint8" }],
    [r.gamePk, r.seq, r.outcome],
  );
}
