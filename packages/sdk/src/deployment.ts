import type { Address } from "viem";

export interface Deployment {
  chainId: number;
  token: Address;
  /** true when the stake token is a test-only token deployed by us, never real money */
  tokenIsTestOnly: boolean;
  vault: Address;
  oracle: Address;
  market: Address;
  startBlock: number;
  policyId: number;
}
