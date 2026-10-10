"use client";

import { STATE_LABEL, State } from "@hyperhedge/sdk";
import Link from "next/link";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { pub } from "@/lib/chain";
import { loadContracts, marketContract, usePoll } from "@/lib/data";
import { bytes32Label, usd } from "@/lib/format";
import s from "../pages.module.css";

export default function Secondary() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const data = usePoll(
    async () => {
      if (!account) return [];
      const rows = await loadContracts();
      const held = await Promise.all(rows.map((r) => pub.readContract({ ...marketContract, functionName: "balanceOf", args: [account, r.id] })));
      return rows.map((r, i) => ({ r, units: held[i]! })).filter((x) => x.units > 0n);
    },
    10_000,
    [account],
  );

  const send = (id: bigint, units: bigint) =>
    tx.run([
      {
        label: `Transfer ${units} unit${units > 1n ? "s" : ""} of #${id}`,
        request: { ...marketContract, functionName: "safeTransferFrom", args: [account!, to as Address, id, units, "0x"] },
      },
    ]);

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Secondary Market</h1>
        <p>
          Every unit of protection is an ERC-1155 token, and the right to claim moves with it. You can hand a position to anyone today, and
          whoever holds it at settlement is paid. Onchain listings with price-and-fill are the next contract; until it ships, trades are
          agreed off-app and settled here by transfer.
        </p>
      </header>

      {!account ? (
        <section className={`panel ${s.card}`}>
          <p>Connect a wallet to see the positions you can transfer.</p>
          <button className="btn" onClick={connect} style={{ justifySelf: "start" }}>
            Connect wallet
          </button>
        </section>
      ) : (
        <section className={`panel ${s.card}`}>
          <h2>Your transferable positions</h2>
          <label>
            Recipient address
            <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
          </label>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Underlying</th>
                  <th>State</th>
                  <th>You hold</th>
                  <th>Pays on failure</th>
                  <th>Units to send</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data.data ?? []).map(({ r, units }) => {
                  const n = BigInt(Math.max(1, Math.min(Number(units), Math.floor(+(amounts[r.id.toString()] ?? units.toString()) || 1))));
                  return (
                    <tr key={r.id.toString()}>
                      <td className="num">
                        <Link href={`/app/c/${r.id}`}>{r.id.toString()}</Link>
                      </td>
                      <td>{bytes32Label(r.terms.underlying)}</td>
                      <td>{STATE_LABEL[r.status.state as State]}</td>
                      <td className="num">{units.toString()}</td>
                      <td className="num">{usd(units * r.terms.payoutPerUnit)}</td>
                      <td style={{ width: 110 }}>
                        <input value={amounts[r.id.toString()] ?? units.toString()} onChange={(e) => setAmounts({ ...amounts, [r.id.toString()]: e.target.value })} />
                      </td>
                      <td>
                        <button className="btn quiet" disabled={!isAddress(to)} onClick={() => send(r.id, n)}>
                          Transfer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.data && !data.data.length ? <p className={s.mute}>You do not hold any protection yet.</p> : null}
          <TxStatus state={tx.state} />
        </section>
      )}
    </main>
  );
}
