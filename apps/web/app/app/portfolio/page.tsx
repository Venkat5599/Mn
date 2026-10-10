"use client";

import { STATE_LABEL, State } from "@hyperhedge/sdk";
import Link from "next/link";
import { useState } from "react";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { pub } from "@/lib/chain";
import { loadContracts, marketContract, usePoll, vaultContract } from "@/lib/data";
import { bytes32Label, usd } from "@/lib/format";
import s from "../form.module.css";

export default function Portfolio() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const [amount, setAmount] = useState("");
  const data = usePoll(
    async () => {
      if (!account) return undefined;
      const [rows, free] = await Promise.all([loadContracts(), pub.readContract({ ...vaultContract, functionName: "free", args: [account] })]);
      const held = await Promise.all(rows.map((r) => pub.readContract({ ...marketContract, functionName: "balanceOf", args: [account, r.id] })));
      return {
        free,
        positions: rows.map((r, i) => ({ r, units: held[i]! })).filter((p) => p.units > 0n),
        selling: rows.filter((r) => r.terms.seller.toLowerCase() === account.toLowerCase()),
      };
    },
    5_000,
    [account],
  );

  if (!account)
    return (
      <main className={`wrap ${s.main}`}>
        <h1>Portfolio</h1>
        <button className="btn" onClick={connect} style={{ justifySelf: "start" }}>
          Connect wallet
        </button>
      </main>
    );

  const d = data.data;
  return (
    <main className={`wrap ${s.main}`}>
      <header className={s.head}>
        <h1>Portfolio</h1>
      </header>

      <section className={`panel ${s.block}`}>
        <h2>Protection you hold</h2>
        {d?.positions.length ? (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Underlying</th>
                  <th>State</th>
                  <th>Units</th>
                  <th>Paid if failure is verified</th>
                </tr>
              </thead>
              <tbody>
                {d.positions.map(({ r, units }) => (
                  <tr key={r.id.toString()}>
                    <td className="num">
                      <Link href={`/app/c/${r.id}`}>{r.id.toString()}</Link>
                    </td>
                    <td>{bytes32Label(r.terms.underlying)}</td>
                    <td className={`st st-${STATE_LABEL[r.status.state as State].toLowerCase().replace(" ", "")}`}>{STATE_LABEL[r.status.state as State]}</td>
                    <td className="num">{units.toString()}</td>
                    <td className="num">{usd(units * (r.terms.payoutPerUnit + r.status.bondPerUnit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{d ? "No positions yet." : "Loading…"}</p>
        )}
      </section>

      <section className={`panel ${s.block}`}>
        <h2>Protection you sell</h2>
        {d?.selling.length ? (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>State</th>
                  <th>Sold</th>
                  <th>Collateral at risk</th>
                  <th>Premium earned if delivered</th>
                </tr>
              </thead>
              <tbody>
                {d.selling.map((r) => (
                  <tr key={r.id.toString()}>
                    <td className="num">
                      <Link href={`/app/c/${r.id}`}>{r.id.toString()}</Link>
                    </td>
                    <td className={`st st-${STATE_LABEL[r.status.state as State].toLowerCase().replace(" ", "")}`}>{STATE_LABEL[r.status.state as State]}</td>
                    <td className="num">
                      {r.status.sold.toString()} / {r.terms.units.toString()}
                    </td>
                    <td className="num">{usd(r.status.sold * r.terms.payoutPerUnit)}</td>
                    <td className="num">{usd(r.status.sold * r.terms.premiumPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            {d ? (
              <>
                You have not issued protection. <Link href="/app/issue">Issue a contract</Link>.
              </>
            ) : (
              "Loading…"
            )}
          </p>
        )}
      </section>

      <section className={`panel ${s.summary}`}>
        <h2>Vault balance</h2>
        <p>
          Free to withdraw: <b className="num">{d ? usd(d.free) : "…"}</b> hhUSD. Collateral reserved for live contracts cannot be withdrawn.
        </p>
        <label style={{ width: "min(320px, 100%)" }}>
          Amount
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </label>
        <button
          className="btn quiet"
          disabled={!d || !(+amount > 0)}
          onClick={() => tx.run([{ label: "Withdraw", request: { ...vaultContract, functionName: "withdraw", args: [BigInt(Math.round(+amount * 100)) * 10_000n] } }])}
        >
          Withdraw
        </button>
        <TxStatus state={tx.state} />
      </section>
    </main>
  );
}
