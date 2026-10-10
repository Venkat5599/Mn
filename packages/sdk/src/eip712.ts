import type { Address, Hex } from "viem";

/** Mirrors ComputeMarket.Outcome. Order is ABI: never reorder. */
export const Outcome = { NONE: 0, FAILURE: 1, DELIVERED: 2 } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

/** Mirrors ComputeMarket.State. Order is ABI: never reorder. */
export const State = {
  NONE: 0,
  OPEN: 1,
  ACTIVE: 2,
  REVIEW: 3,
  DISPUTED: 4,
  DELIVERED: 5,
  SETTLED: 6,
  EXPIRED: 7,
  VOIDED: 8,
} as const;
export type State = (typeof State)[keyof typeof State];

export const STATE_LABEL: Record<State, string> = {
  0: "None",
  1: "Open",
  2: "Active",
  3: "In review",
  4: "Disputed",
  5: "Delivered",
  6: "Settled",
  7: "Expired",
  8: "Voided",
};

export interface IncidentReport {
  contractId: bigint;
  incidentId: Hex;
  outcome: number;
  evidenceHash: Hex;
  observedAt: bigint;
  validUntil: bigint;
}

export const reportTypes = {
  IncidentReport: [
    { name: "contractId", type: "uint256" },
    { name: "incidentId", type: "bytes32" },
    { name: "outcome", type: "uint8" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "observedAt", type: "uint64" },
    { name: "validUntil", type: "uint64" },
  ],
} as const;

export function reportDomain(chainId: number, verifier: Address) {
  return { name: "HYPERHEDGE", version: "1", chainId, verifyingContract: verifier } as const;
}
