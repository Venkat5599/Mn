"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Address, Hash } from "viem";
import { connectWallet, pub, walletClient } from "@/lib/chain";

interface WalletCtx {
  account?: Address;
  connecting: boolean;
  error?: string;
  connect: () => Promise<void>;
}

const Ctx = createContext<WalletCtx>({ connecting: false, connect: async () => {} });

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    void eth.request({ method: "eth_accounts" }).then((a) => setAccount((a as Address[])[0]));
    const onChange = (a: unknown) => setAccount((a as Address[])[0]);
    eth.on?.("accountsChanged", onChange);
    return () => eth.removeListener?.("accountsChanged", onChange);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(undefined);
    try {
      setAccount(await connectWallet());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  return <Ctx.Provider value={{ account, connecting, error, connect }}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

export type TxState = { phase: "idle" } | { phase: "signing"; label: string } | { phase: "pending"; label: string; hash: Hash } | { phase: "done"; label: string; hash: Hash } | { phase: "failed"; label: string; error: string; hash?: Hash };

/** Runs a sequence of writes, reporting the real wallet and receipt status of each. */
export function useTx() {
  const { account } = useWallet();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async (steps: { label: string; request: Record<string, unknown> }[]) => {
      if (!account) throw new Error("connect a wallet first");
      const w = walletClient(account);
      for (const s of steps) {
        let hash: Hash | undefined;
        try {
          setState({ phase: "signing", label: s.label });
          const gas = await pub.estimateContractGas({ ...(s.request as any), account });
          hash = await w.writeContract({ ...(s.request as any), account, gas: (gas * 13n) / 10n });
          setState({ phase: "pending", label: s.label, hash });
          const r = await pub.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error("reverted onchain");
          setState({ phase: "done", label: s.label, hash });
        } catch (e) {
          const msg = e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e);
          setState({ phase: "failed", label: s.label, error: msg.split("\n")[0]!, hash });
          return false;
        }
      }
      return true;
    },
    [account],
  );

  return { state, run, reset: () => setState({ phase: "idle" }) };
}
