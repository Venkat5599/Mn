import { defineChain } from "viem";
import { foundry } from "viem/chains";

/** [verify D1] RPC and explorer URLs against docs.monad.xyz before deploying. */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const local = foundry;

export function chainFor(id: number) {
  if (id === monadTestnet.id) return monadTestnet;
  if (id === local.id) return local;
  throw new Error(`unsupported chain ${id}`);
}

export const txUrl = (chainId: number, hash: string) =>
  chainId === monadTestnet.id ? `${monadTestnet.blockExplorers.default.url}/tx/${hash}` : undefined;
