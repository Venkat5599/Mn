import { keccak256, toHex, type Hex } from "viem";

/**
 * The objective delivery condition. Committed onchain by `slaHash` and carried in full in `slaURI`
 * (an inline data: URI), so the terms a buyer reads are exactly the terms the oracle evaluates.
 */
export interface Sla {
  v: 1;
  kind: "pow-delivery";
  /** What actually delivers the compute. Honest label: the demo host is a CPU VPS. */
  computeClass: string;
  /** Agent endpoint the oracle sends challenges to. */
  host: string;
  difficultyBits: number;
  /** Delivered when at least this many challenges are answered correctly and on time. */
  requiredSolves: number;
  /** Seconds between challenges during the delivery window. */
  intervalSec: number;
  /** A correct answer arriving later than this counts as not delivered. */
  answerWithinSec: number;
}

/** Deterministic JSON: sorted keys, no whitespace. A hash input must never depend on key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function slaHash(sla: Sla): Hex {
  return keccak256(toHex(canonicalJson(sla)));
}

const DATA_PREFIX = "data:application/json;base64,";

export function slaToUri(sla: Sla): string {
  return DATA_PREFIX + btoa(canonicalJson(sla));
}

export function slaFromUri(uri: string): Sla {
  if (!uri.startsWith(DATA_PREFIX)) throw new Error("SLA URI must be an inline data: URI");
  const sla = JSON.parse(atob(uri.slice(DATA_PREFIX.length))) as Sla;
  validateSla(sla);
  return sla;
}

export function validateSla(s: Sla): void {
  if (s.v !== 1 || s.kind !== "pow-delivery") throw new Error("unsupported SLA");
  if (!/^https?:\/\//.test(s.host)) throw new Error("SLA host must be an http(s) URL");
  if (!Number.isInteger(s.difficultyBits) || s.difficultyBits < 8 || s.difficultyBits > 40)
    throw new Error("difficultyBits out of range");
  if (!Number.isInteger(s.requiredSolves) || s.requiredSolves < 1) throw new Error("requiredSolves must be at least 1");
  if (s.intervalSec < 1 || s.answerWithinSec < 1) throw new Error("bad timing");
}

/** The most challenges a perfect host can answer inside a window. */
export function maxChallenges(sla: Sla, windowStart: number, windowEnd: number): number {
  return Math.max(0, Math.floor((windowEnd - windowStart - sla.answerWithinSec) / sla.intervalSec) + 1);
}
