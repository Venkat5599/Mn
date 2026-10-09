import { describe, expect, test } from "bun:test";
import { decodeAbiParameters } from "viem";
import feedJson from "../../../fixtures/mlb/feed-849834-final.json";
import { Outcome, encodeConfirmReport, flattenPitches, resolveConfirmation, type MlbFeed } from "../src";

const feed = feedJson as unknown as MlbFeed;
const pitches = flattenPitches(feed);
const GAME = 849834;

describe("resolveConfirmation", () => {
  test("agrees with the feed for an honest claim", () => {
    const p = pitches[41]!;
    const r = resolveConfirmation(feed, { gamePk: GAME, seq: p.seq, playId: p.playId });
    expect(r).toEqual({ gamePk: GAME, seq: p.seq, outcome: p.outcome, reason: "ok" });
  });

  test("votes VOID when the relayer lies about the seq", () => {
    const p = pitches[41]!;
    const r = resolveConfirmation(feed, { gamePk: GAME, seq: p.seq + 1, playId: p.playId });
    expect(r.outcome).toBe(Outcome.VOID);
    expect(r.reason).toBe("seq-mismatch");
  });

  test("votes VOID when the pitch vanished from the feed", () => {
    const r = resolveConfirmation(feed, { gamePk: GAME, seq: 1, playId: "not-a-real-play" });
    expect(r.reason).toBe("playId-missing");
  });

  test("report bytes round-trip to what PitchOracle.onReport decodes", () => {
    const hex = encodeConfirmReport({ gamePk: GAME, seq: 7, outcome: Outcome.FOUL });
    const [g, s, o] = decodeAbiParameters([{ type: "uint32" }, { type: "uint16" }, { type: "uint8" }], hex);
    expect([g, s, o]).toEqual([GAME, 7, Outcome.FOUL]);
  });
});
