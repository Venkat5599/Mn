import { describe, expect, test } from "bun:test";
import feedJson from "../../../fixtures/mlb/feed-849834-final.json";
import {
  Outcome,
  flattenPitches,
  impliedMultiple,
  projectPayout,
  mapCall,
  maxBetFor,
  seqOfPlayId,
  snapshot,
  type MlbFeed,
} from "../src";

// Real recorded game: CWS @ CLE, 2026-10-05, gamePk 849834 (trimmed to the fields Pitchside reads).
const feed = feedJson as unknown as MlbFeed;
const pitches = flattenPitches(feed);

describe("mapCall", () => {
  test("maps every PRD call", () => {
    expect(mapCall("Ball")).toBe(Outcome.BALL);
    expect(mapCall("Hit By Pitch")).toBe(Outcome.BALL);
    expect(mapCall("Foul Tip")).toBe(Outcome.STRIKE);
    expect(mapCall("Swinging Strike (Blocked)")).toBe(Outcome.STRIKE);
    expect(mapCall("Foul Bunt")).toBe(Outcome.FOUL);
    expect(mapCall("In play, run(s)")).toBe(Outcome.IN_PLAY);
  });

  test("falls back to the call code, then VOID", () => {
    expect(mapCall("Some New Call", "C")).toBe(Outcome.STRIKE);
    expect(mapCall("Some New Call", "??")).toBe(Outcome.VOID);
    expect(mapCall(undefined)).toBe(Outcome.VOID);
  });
});

describe("flattenPitches on a real game", () => {
  test("finds all 294 pitches with dense 1-based seqs", () => {
    expect(pitches.length).toBe(294);
    pitches.forEach((p, i) => expect(p.seq).toBe(i + 1));
  });

  test("every pitch maps to a real outcome (no VOID in this game)", () => {
    expect(pitches.filter((p) => p.outcome === Outcome.VOID)).toHaveLength(0);
    const tally = (o: Outcome) => pitches.filter((p) => p.outcome === o).length;
    expect(tally(Outcome.BALL)).toBe(112); // 102 Ball + 10 Ball In Dirt
    expect(tally(Outcome.STRIKE)).toBe(95); // 54 called + 39 swinging + 2 blocked
    expect(tally(Outcome.FOUL)).toBe(45);
    expect(tally(Outcome.IN_PLAY)).toBe(42);
  });

  test("timestamps are floored seconds and ordered", () => {
    for (const p of pitches) {
      expect(p.endTs).toBeGreaterThanOrEqual(p.startTs);
      expect(p.startTs).toBe(Math.floor(p.startMs / 1000));
    }
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]!.startMs).toBeGreaterThan(pitches[i - 1]!.startMs);
    }
  });

  test("an 8s lock is safe: next pitch almost always starts after end + 8s", () => {
    let unsafe = 0;
    for (let i = 1; i < pitches.length; i++) {
      if (pitches[i]!.startTs < pitches[i - 1]!.endTs + 8) unsafe++;
    }
    // Late bets in the rest are refunded on chain; this asserts the window is rarely tight.
    expect(unsafe / pitches.length).toBeLessThan(0.02);
  });

  test("playIds are unique and resolvable", () => {
    expect(new Set(pitches.map((p) => p.playId)).size).toBe(pitches.length);
    expect(seqOfPlayId(pitches, pitches[99]!.playId)).toBe(100);
    expect(seqOfPlayId(pitches, "missing")).toBe(-1);
  });
});

describe("snapshot", () => {
  test("reads the final state", () => {
    const s = snapshot(feed);
    expect(s.phase).toBe("final");
    expect(s.away).toBe("CWS");
    expect(s.home).toBe("CLE");
  });
});

describe("maxBetFor", () => {
  test("matches the contract", () => {
    expect(maxBetFor(1_000n)).toBe(250n);
    expect(maxBetFor(3n)).toBe(1n);
    expect(maxBetFor(0n)).toBe(0n);
  });
});

describe("projectPayout", () => {
  // pot indexed by Outcome: [NONE, BALL, STRIKE, FOUL, IN_PLAY]
  const pot = [0n, 150n, 150n, 0n, 0n];
  test("matches the contract test: 100 of 150 on the winning side of a 300 pot", () => {
    expect(projectPayout(pot, Outcome.STRIKE, Outcome.STRIKE, 100n, 0).payout).toBe(200n);
    expect(projectPayout(pot, Outcome.BALL, Outcome.STRIKE, 150n, 0).payout).toBe(0n);
  });
  test("refunds when nobody won or one side only", () => {
    expect(projectPayout(pot, Outcome.BALL, Outcome.FOUL, 150n, 0)).toEqual({ payout: 150n, refunded: true });
    expect(projectPayout([0n, 5n, 0n, 0n, 0n], Outcome.BALL, Outcome.BALL, 5n, 400).refunded).toBe(true);
  });
  test("implied multiple", () => {
    expect(impliedMultiple(pot, Outcome.BALL)).toBe(2);
    expect(impliedMultiple(pot, Outcome.FOUL)).toBeNull();
  });
});
