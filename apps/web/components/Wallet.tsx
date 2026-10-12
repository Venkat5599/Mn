"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Address, type Hash } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { chain, pub } from "@/lib/chain";

/** Wallet state from wagmi; `connect` opens the RainbowKit modal. */
export function useWallet(): { account?: Address; connecting: boolean; error?: string; connect: () => void } {
  const { address, isConnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  return { account: address, connecting: isConnecting, connect: () => openConnectModal?.() };
}

export type TxState =
  | { phase: "idle" }
  | { phase: "signing"; label: string }
  | { phase: "pending"; label: string; hash: Hash }
  | { phase: "done"; label: string; hash: Hash }
  | { phase: "failed"; label: string; error: string; hash?: Hash };

const erc20Errors = [
  { type: "error", name: "ERC20InsufficientBalance", inputs: [{ name: "sender", type: "address" }, { name: "balance", type: "uint256" }, { name: "needed", type: "uint256" }] },
  { type: "error", name: "ERC20InsufficientAllowance", inputs: [{ name: "spender", type: "address" }, { name: "allowance", type: "uint256" }, { name: "needed", type: "uint256" }] },
] as const;

const revertName = (e: unknown) =>
  e instanceof BaseError ? (e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null)?.data : undefined;

/** A step right after an approve can hit an RPC node that has not seen it yet; wait and retry only that case. */
async function estimateWithLag(req: any, afterPrevious: boolean): Promise<bigint> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pub.estimateContractGas(req);
    } catch (e) {
      if (!afterPrevious || attempt >= 5 || revertName(e)?.errorName !== "ERC20InsufficientAllowance") throw e;
      await new Promise((r) => setTimeout(r, 1_500));
    }
  }
}

const hh = (v: unknown) => (Number(v as bigint) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });

function explain(e: unknown): string {
  const d = revertName(e);
  if (d?.errorName === "ERC20InsufficientBalance") {
    const [, bal, need] = d.args ?? [];
    return `Not enough hhUSD in your wallet: you have ${hh(bal)}, this needs ${hh(need)}. Get test hhUSD from the faucet first.`;
  }
  if (d?.errorName === "ERC20InsufficientAllowance") return "The approval has not reached the network yet. Try again in a few seconds.";
  if (d?.errorName) return `Reverted: ${d.errorName}${d.args?.length ? `(${d.args.map(String).join(", ")})` : ""}`;
  const msg = e instanceof Error ? ((e as { shortMessage?: string }).shortMessage ?? e.message) : String(e);
  return msg.split("\n")[0]!;
}

/** Runs a sequence of writes, reporting the real wallet and receipt status of each. */
export function useTx() {
  const { address, chainId } = useAccount();
  const { data: wallet } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async (steps: { label: string; request: Record<string, unknown> }[]) => {
      if (!address || !wallet) throw new Error("connect a wallet first");
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      for (const [i, s] of steps.entries()) {
        let hash: Hash | undefined;
        // Token errors live in the token, not the called contract's ABI; add them so viem can decode the revert.
        const req = { ...(s.request as any), abi: [...((s.request as any).abi ?? []), ...erc20Errors], account: address };
        try {
          setState({ phase: "signing", label: s.label });
          const gas = await estimateWithLag(req, i > 0);
          hash = await wallet.writeContract({ ...req, chain, gas: (gas * 13n) / 10n });
          setState({ phase: "pending", label: s.label, hash });
          const r = await pub.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error("reverted onchain");
          setState({ phase: "done", label: s.label, hash });
        } catch (e) {
          setState({ phase: "failed", label: s.label, error: explain(e), hash });
          return false;
        }
      }
      return true;
    },
    [address, wallet, chainId, switchChainAsync],
  );

  return { state, run, reset: () => setState({ phase: "idle" }) };
}
