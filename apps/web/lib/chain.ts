"use client";

import { monadTestnet, type Deployment } from "@hyperhedge/sdk";
import { createPublicClient, createWalletClient, custom, fallback, http, type Address, type EIP1193Provider } from "viem";

/** Public addresses of the live Monad testnet deployment (deployments/10143.json). */
export const deployment: Deployment = {
  chainId: 10143,
  token: (process.env.NEXT_PUBLIC_TOKEN ?? "0xeeBDcA711Cb71A85b791141180a9548206C94063") as Address,
  tokenIsTestOnly: true,
  vault: (process.env.NEXT_PUBLIC_VAULT ?? "0xf2aF6d0D92ED7106e064F02087586E4464E029D3") as Address,
  oracle: (process.env.NEXT_PUBLIC_ORACLE ?? "0xE65E13b3c69c1057FDDdA52CA96B0cB6721eb8D4") as Address,
  market: (process.env.NEXT_PUBLIC_MARKET ?? "0x9dc5f35B0866bB0a1F046712B38f11E2544D701E") as Address,
  startBlock: 69_898_677,
  policyId: 1,
};

export const chain = monadTestnet;
export const explorer = monadTestnet.blockExplorers.default.url;
export const ORACLE_API = "/api/oracle";

// Reads made in the same tick go out as one Multicall3 call, and a throttled RPC falls through to the next.
export const pub = createPublicClient({
  chain,
  batch: { multicall: { wait: 16 } },
  transport: fallback(
    [
      http(process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0], { timeout: 8_000, retryCount: 1 }),
      http("https://monad-testnet.drpc.org", { timeout: 8_000, retryCount: 1 }),
      http("https://10143.rpc.thirdweb.com", { timeout: 8_000, retryCount: 1 }),
    ],
    { retryCount: 1 },
  ),
});

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export const tokenAbi = [
  { type: "function", name: "faucet", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "lastDrip", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "allowance", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

export async function connectWallet(): Promise<Address> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  const [account] = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!account) throw new Error("The wallet returned no account.");
  await ensureChain(eth);
  return account;
}

async function ensureChain(eth: EIP1193Provider) {
  const hex = `0x${chain.id.toString(16)}` as const;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [...chain.rpcUrls.default.http],
          blockExplorerUrls: [explorer],
        },
      ],
    });
  }
}

export function walletClient(account: Address) {
  if (!window.ethereum) throw new Error("No browser wallet found.");
  return createWalletClient({ account, chain, transport: custom(window.ethereum) });
}

export const txLink = (hash: string) => `${explorer}/tx/${hash}`;
export const addrLink = (a: string) => `${explorer}/address/${a}`;
