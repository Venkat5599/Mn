"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useState } from "react";
import type { Address, Hash } from "viem";
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
      for (const s of steps) {
        let hash: Hash | undefined;
        try {
          setState({ phase: "signing", label: s.label });
          const gas = await pub.estimateContractGas({ ...(s.request as any), account: address });
          hash = await wallet.writeContract({ ...(s.request as any), account: address, chain, gas: (gas * 13n) / 10n });
          setState({ phase: "pending", label: s.label, hash });
          const r = await pub.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error("reverted onchain");
          setState({ phase: "done", label: s.label, hash });
        } catch (e) {
          const msg = e instanceof Error ? ((e as { shortMessage?: string }).shortMessage ?? e.message) : String(e);
          setState({ phase: "failed", label: s.label, error: msg.split("\n")[0]!, hash });
          return false;
        }
      }
      return true;
    },
    [address, wallet, chainId, switchChainAsync],
  );

  return { state, run, reset: () => setState({ phase: "idle" }) };
}
