import { chainById } from "@pitchside/shared";
import { createPublicClient, createWalletClient, http, type LocalAccount } from "viem";
import { env } from "./env";

export const chain = chainById(env.chainId);
// JSON-RPC batching: one HTTP round trip for the ~10 reads the board makes each second.
const transport = http(env.rpcUrl, { batch: { wait: 16 }, retryCount: 2, timeout: 8_000 });

export const publicClient = createPublicClient({ chain, transport, pollingInterval: 300 });

export function walletFor(account: LocalAccount) {
  return createWalletClient({ chain, transport, account });
}

export function txUrl(hash: string) {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

export function addressUrl(address: string) {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : undefined;
}
