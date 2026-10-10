import { describe, expect, test } from "bun:test";
import { keccak256, toHex, type Hex } from "viem";
import {
  buildEvidence,
  checkPow,
  deriveSeed,
  evidenceHash,
  leadingZeroBits,
  slaFromUri,
  slaHash,
  slaToUri,
  verifyEvidence,
  type ChallengeRecord,
  type Sla,
} from "../src";

const sla: Sla = {
  v: 1,
  kind: "pow-delivery",
  computeClass: "vCPU · demo host",
  host: "http://127.0.0.1:8790",
  difficultyBits: 12,
  requiredSolves: 2,
  intervalSec: 10,
  answerWithinSec: 20,
};

function solve(seed: Hex, bits: number): bigint {
  for (let n = 0n; ; n++) if (checkPow(seed, n, bits)) return n;
}

function challenge(index: number, answered: boolean, late = false): ChallengeRecord {
  const blockHash = keccak256(toHex(`block-${index}`));
  const seed = deriveSeed(7n, index, blockHash);
  const issuedAt = 1_000_000 + index * 10_000;
  return {
    index,
    blockNumber: 100 + index,
    blockHash,
    seed,
    issuedAt,
    dueBy: issuedAt + 20_000,
    nonce: answered ? solve(seed, sla.difficultyBits).toString() : null,
    answeredAt: answered ? issuedAt + (late ? 25_000 : 1_000) : null,
  };
}

const base = (challenges: ChallengeRecord[]) => ({
  chainId: 31337,
  contractId: "7",
  slaHash: slaHash(sla),
  windowStart: 1_000,
  windowEnd: 1_100,
  difficultyBits: sla.difficultyBits,
  requiredSolves: sla.requiredSolves,
  challenges,
});

describe("proof of work", () => {
  test("leading zero bits", () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x0f]))).toBe(12);
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
  });

  test("a found nonce verifies, a neighbour almost never does", () => {
    const seed = deriveSeed(1n, 0, keccak256("0x01"));
    const n = solve(seed, 12);
    expect(checkPow(seed, n, 12)).toBe(true);
    expect(checkPow(seed, n, 40)).toBe(false);
  });
});

describe("SLA", () => {
  test("round-trips through its data URI and hashes independent of key order", () => {
    expect(slaFromUri(slaToUri(sla))).toEqual(sla);
    const shuffled = { answerWithinSec: 20, ...sla } as Sla;
    expect(slaHash(shuffled)).toBe(slaHash(sla));
  });
});

describe("evidence", () => {
  test("delivered when enough valid, on-time answers", async () => {
    const e = buildEvidence(base([challenge(0, true), challenge(1, true), challenge(2, false)]));
    expect(e.solved).toBe(2);
    expect(e.verdict).toBe("DELIVERED");
    expect((await verifyEvidence(e, sla)).ok).toBe(true);
  });

  test("late and missing answers count as not delivered", async () => {
    const e = buildEvidence(base([challenge(0, true), challenge(1, true, true), challenge(2, false)]));
    expect(e.solved).toBe(1);
    expect(e.verdict).toBe("FAILURE");
  });

  test("tampering is caught by recount", async () => {
    const e = buildEvidence(base([challenge(0, true), challenge(1, false)]));
    const forged = { ...e, solved: 2, verdict: "DELIVERED" as const };
    const check = await verifyEvidence(forged, sla);
    expect(check.ok).toBe(false);
    expect(check.verdict).toBe("FAILURE");
    expect(evidenceHash(forged)).not.toBe(evidenceHash(e));
  });

  test("a seed not derived from its block is rejected", async () => {
    const c = challenge(0, true);
    const e = buildEvidence(base([{ ...c, blockHash: keccak256("0xdead") }, challenge(1, true)]));
    expect(e.solved).toBe(1);
  });

  test("block hashes are checked against the chain when a reader is given", async () => {
    const e = buildEvidence(base([challenge(0, true), challenge(1, true)]));
    const check = await verifyEvidence(e, sla, async () => keccak256("0xbeef"));
    expect(check.ok).toBe(false);
  });
});
