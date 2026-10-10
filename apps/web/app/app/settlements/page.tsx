"use client";

import { STATE_LABEL, State } from "@hyperhedge/sdk";
import Link from "next/link";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { pub, txLink } from "@/lib/chain";
import { loadContracts, loadOracle, marketContract, usePoll } from "@/lib/data";
import { bytes32Label, short, usd, when } from "@/lib/format";
import { P8, loadPoolState } from "@/lib/pool";
import s from "../pages.module.css";

export default function Settlements() {
  const { account } = useWallet();
  const tx = useTx();
  const rows = usePoll(loadContracts, 10_000, []);
  const oracle = usePoll(loadOracle, 10_000, []);
  const pool = usePoll(loadPoolState, 12_000, []);
  const held = usePoll(
    async () => {
      if (!account || !rows.data) return {} as Record<string, bigint>;
      const out: Record<string, bigint> = {};
      await Promise.all(rows.data.map(async (r) => (out[r.id.toString()] = await pub.readContract({ ...marketContract, functionName: "balanceOf", args: [account, r.id] }))));
      return out;
    },
    10_000,
    [account, rows.data?.length],
  );

  const done = (rows.data ?? []).filter((r) => r.status.state >= State.DELIVERED);
  const paidCompute = done.filter((r) => r.status.state === State.SETTLED).reduce((n, r) => n + r.status.sold * r.terms.payoutPerUnit, 0n);
  const poolDone = (pool.data?.positions ?? []).filter((p) => p.settled);
  const paidPool = poolDone.reduce((n, p) => n + p.paid, 0n);

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Settlements &amp; Claims</h1>
        <p>Every contract that reached a final outcome, what it paid, and the transaction that proves it. Holders of a failed delivery claim here.</p>
      </header>

      <div className={s.stats}>
        <div className={`panel ${s.stat}`}>
          <span>Delivery contracts settled</span>
          <b className="num">{done.length}</b>
        </div>
        <div className={`panel ${s.stat}`}>
          <span>Paid for failed deliveries</span>
          <b className="num">{usd(paidCompute)}</b>
          <small>hhUSD</small>
        </div>
        <div className={`panel ${s.stat}`}>
          <span>Price protection settled</span>
          <b className="num">{poolDone.length}</b>
        </div>
        <div className={`panel ${s.stat}`}>
          <span>Paid for price drops</span>
          <b className="num">{usd(paidPool)}</b>
          <small>hhUSD</small>
        </div>
      </div>

      <section className={`panel ${s.card}`}>
        <h2>Delivery protection</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Underlying</th>
                <th>Outcome</th>
                <th>Proofs</th>
                <th>Paid to buyers</th>
                <th>Report</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {done.map((r) => {
                const o = oracle.data?.find((x) => x.id === r.id.toString());
                const mine = held.data?.[r.id.toString()] ?? 0n;
                const claimable = r.status.state === State.SETTLED && mine > 0n;
                return (
                  <tr key={r.id.toString()}>
                    <td className="num">
                      <Link href={`/app/c/${r.id}`}>{r.id.toString()}</Link>
                    </td>
                    <td>{bytes32Label(r.terms.underlying)}</td>
                    <td className={r.status.state === State.SETTLED ? s.bad : s.ok}>{STATE_LABEL[r.status.state as State]}</td>
                    <td className="num">{o ? `${o.answered} / ${o.issued}` : "…"}</td>
                    <td className="num">{r.status.state === State.SETTLED ? usd(r.status.sold * r.terms.payoutPerUnit) : "0"}</td>
                    <td>
                      {o?.reportTx ? (
                        <a href={txLink(o.reportTx)} target="_blank" rel="noreferrer" className="mono">
                          {short(o.reportTx)}
                        </a>
                      ) : (
                        <span className={s.mute}>{o?.abstained ? "oracle abstained" : "none"}</span>
                      )}
                    </td>
                    <td>
                      {claimable ? (
                        <button className="btn" onClick={() => tx.run([{ label: `Claim #${r.id}`, request: { ...marketContract, functionName: "claim", args: [r.id] } }])}>
                          Claim {usd(mine * (r.terms.payoutPerUnit + r.status.bondPerUnit))}
                        </button>
                      ) : (
                        <Link href={`/app/c/${r.id}`}>Verify evidence</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!done.length && !rows.error ? <p className={s.mute}>Nothing has settled yet.</p> : null}
        <TxStatus state={tx.state} />
      </section>

      <section className={`panel ${s.card}`}>
        <h2>Price protection</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Holder</th>
                <th>Cover</th>
                <th>Strike</th>
                <th>Price at expiry</th>
                <th>Expired</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {poolDone.map((p) => (
                <tr key={p.id.toString()}>
                  <td className="num">{p.id.toString()}</td>
                  <td className="num">{short(p.owner)}</td>
                  <td className="num">{usd(p.notional)}</td>
                  <td className="num">${(Number(p.strike) / P8).toFixed(5)}</td>
                  <td className="num">{p.expiryPrice ? `$${(Number(p.expiryPrice) / P8).toFixed(5)}` : "not reported"}</td>
                  <td className="num">{when(p.expiry)}</td>
                  <td className={`num ${p.paid > 0n ? s.ok : ""}`}>{usd(p.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!poolDone.length ? <p className={s.mute}>No price protection has expired yet. The keeper settles each one within a minute of expiry.</p> : null}
      </section>
    </main>
  );
}
