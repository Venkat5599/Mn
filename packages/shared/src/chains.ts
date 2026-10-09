import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://monadexplorer.com" } },
});

export const anvilLocal = defineChain({
  id: 31_337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

export const CHAINS = { [monadTestnet.id]: monadTestnet, [monadMainnet.id]: monadMainnet, [anvilLocal.id]: anvilLocal };
export type SupportedChainId = keyof typeof CHAINS;

export function chainById(id: number) {
  const c = CHAINS[id as SupportedChainId];
  if (!c) throw new Error(`Unsupported chain id ${id}`);
  return c;
}

/**
 * Monad charges the gas LIMIT, not gas used, so every write sets an explicit limit.
 * Each value = peak execution gas from `forge test --gas-report` + contracts/test/GasBudget.t.sol,
 * plus 21k intrinsic and calldata, plus ~25% headroom. Re-measure after any contract change.
 *
 *   function     peak exec   limit
 *   openGame       70.2k     120k
 *   reportPitch    56.2k     110k
 *   closeGame      30.4k      70k
 *   onReport       35.5k     120k   (CRE forwarder adds its own overhead; set in CRE config)
 *   createRoom     52.3k     100k
 *   join          149.9k     220k   (first STAKES join: token pull + member push, cold)
 *   bet           137.6k     200k
 *   settle       ~262k warm, 32 bettors; cold can approach 1M. Keeper estimates per call, capped here.
 *   cashOut        62.0k     110k
 *   approve        46.3k      80k
 */
export const GAS = {
  openGame: 120_000n,
  reportPitch: 110_000n,
  closeGame: 70_000n,
  onReport: 120_000n,
  createRoom: 100_000n,
  join: 220_000n,
  bet: 200_000n,
  /** cap only: the keeper estimates each settle and adds 30% */
  settle: 1_200_000n,
  cashOut: 110_000n,
  approve: 80_000n,
  mint: 110_000n,
  transfer: 21_000n,
} as const;
