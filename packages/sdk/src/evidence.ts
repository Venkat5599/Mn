import { keccak256, toHex, type Hex } from "viem";
import { Outcome } from "./eip712";
import { checkPow, deriveSeed } from "./pow";
import { canonicalJson, type Sla } from "./sla";

export interface ChallengeRecord {
  index: number;
  /** block whose hash seeds this challenge: proves the challenge did not exist before it */
  blockNumber: number;
  blockHash: Hex;
  seed: Hex;
  /** unix ms, oracle clock */
  issuedAt: number;
  dueBy: number;
  /** decimal uint64, or null when the host did not answer */
  nonce: string | null;
  answeredAt: number | null;
}

export interface Evidence {
  v: 1;
  chainId: number;
  contractId: string;
  slaHash: Hex;
  /** unix seconds, the contract's delivery window (saleEnd → deliveryDeadline) */
  windowStart: number;
  windowEnd: number;
  difficultyBits: number;
  requiredSolves: number;
  challenges: ChallengeRecord[];
  solved: number;
  verdict: "DELIVERED" | "FAILURE";
}

export function challengeValid(c: ChallengeRecord, contractId: bigint, difficultyBits: number): boolean {
  if (c.nonce === null || c.answeredAt === null) return false;
  if (c.answeredAt > c.dueBy) return false;
  if (deriveSeed(contractId, c.index, c.blockHash) !== c.seed) return false;
  return checkPow(c.seed, BigInt(c.nonce), difficultyBits);
}

export function buildEvidence(args: Omit<Evidence, "v" | "solved" | "verdict">): Evidence {
  const id = BigInt(args.contractId);
  const solved = args.challenges.filter((c) => challengeValid(c, id, args.difficultyBits)).length;
  return { v: 1, ...args, solved, verdict: solved >= args.requiredSolves ? "DELIVERED" : "FAILURE" };
}

export function evidenceHash(e: Evidence): Hex {
  return keccak256(toHex(canonicalJson(e)));
}

export interface EvidenceCheck {
  ok: boolean;
  solved: number;
  verdict: Evidence["verdict"];
  problems: string[];
}

/**
 * Independent re-verification: recomputes every proof of work, every seed, the count and the verdict.
 * `blockHashOf`, when given, also checks each challenge's block hash against the chain.
 */
export async function verifyEvidence(
  e: Evidence,
  sla: Sla,
  blockHashOf?: (n: number) => Promise<Hex>,
): Promise<EvidenceCheck> {
  const problems: string[] = [];
  const id = BigInt(e.contractId);
  if (e.difficultyBits !== sla.difficultyBits) problems.push("difficulty differs from the SLA");
  if (e.requiredSolves !== sla.requiredSolves) problems.push("required solves differ from the SLA");
  let solved = 0;
  for (const c of e.challenges) {
    if (c.issuedAt < e.windowStart * 1000 || c.issuedAt > e.windowEnd * 1000)
      problems.push(`challenge ${c.index} was issued outside the delivery window`);
    if (blockHashOf && (await blockHashOf(c.blockNumber)) !== c.blockHash)
      problems.push(`challenge ${c.index} block hash does not match the chain`);
    if (challengeValid(c, id, e.difficultyBits)) solved++;
  }
  const verdict = solved >= e.requiredSolves ? "DELIVERED" : "FAILURE";
  if (solved !== e.solved) problems.push(`claims ${e.solved} solved, recount gives ${solved}`);
  if (verdict !== e.verdict) problems.push(`claims ${e.verdict}, recount gives ${verdict}`);
  return { ok: problems.length === 0, solved, verdict, problems };
}

export const outcomeOf = (verdict: Evidence["verdict"]) =>
  verdict === "DELIVERED" ? Outcome.DELIVERED : Outcome.FAILURE;
