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
  /** MON/USD price-protection AMM */
  pricePool?: Address;
  /** onchain order book for protection positions */
  listings?: Address;
}
