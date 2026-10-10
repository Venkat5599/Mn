"use client";

import { txLink } from "@/lib/chain";
import { short } from "@/lib/format";
import type { TxState } from "./Wallet";

/** The real status of the current transaction, straight from the wallet and the receipt. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  const color =
    state.phase === "failed" ? "var(--red)" : state.phase === "done" ? "var(--green)" : "var(--amber)";
  const text =
    state.phase === "signing"
      ? `${state.label}: confirm in your wallet`
      : state.phase === "pending"
        ? `${state.label}: waiting for inclusion`
        : state.phase === "done"
          ? `${state.label}: included`
          : `${state.label}: ${state.error}`;
  const hash = "hash" in state ? state.hash : undefined;
  return (
    <p role="status" style={{ margin: 0, fontSize: 13, color }}>
      {text}
      {hash ? (
        <>
          {" · "}
          <a href={txLink(hash)} target="_blank" rel="noreferrer" className="mono">
            {short(hash)}
          </a>
        </>
      ) : null}
    </p>
  );
}
