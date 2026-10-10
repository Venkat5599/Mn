"use client";

import { STATE_LABEL, State } from "@hyperhedge/sdk";
import Link from "next/link";
import { useState } from "react";
import { loadContracts, loadOracle, usePoll } from "@/lib/data";
import { bytes32Label, usd } from "@/lib/format";
import { P8, loadPoolState, loadSignedPrice } from "@/lib/pool";
import s from "../pages.module.css";

export default function Risk() {
  const rows = usePoll(loadContracts, 12_000, []);
  const oracle = usePoll(loadOracle, 12_000, []);
  const pool = usePoll(loadPoolState, 12_000, []);
  const price = usePoll(loadSignedPrice, 15_000, []);
  const [drop, setDrop] = useState(20);
  const live = price.data ? price.data.report.price / P8 : undefined;
  const open = (pool.data?.positions ?? []).filter((p) => !p.settled);

  // Stress test: what every open policy would pay if MON fell `drop`% from the live price right now.
  const stressed = live ? live * (1 - drop / 100) : undefined;
  const stressPay = stressed
    ? open.reduce((n, p) => {
        const strike = Number(p.strike) / P8;
        const spot = Number(p.spot) / P8;
        if (stressed >= strike) return n;
        return n + Math.min(Number(p.maxPayout), (Number(p.notional) * (strike - stressed)) / spot);
      }, 0)
    : 0;
  const assets = pool.data ? Number(pool.data.assets) : 0;

  const live2 = (rows.data ?? []).filter((r) => r.status.state <= State.DISPUTED && r.status.state >= State.OPEN);

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Risk Engine</h1>
        <p>
          How much could be owed, and what backs it. Every input is read from the chain or the oracle. Probabilities are not estimated: there
          is no failure history yet, so this page shows exposure, not odds.
        </p>
      </header>

      <section className={`panel ${s.card}`}>
        <h2>Price pool stress test</h2>
        <div className={s.row}>
          <label>
            If MON fell this much right now: <b className="num">{drop}%</b>
            <input type="range" min={1} max={90} value={drop} onChange={(e) => setDrop(+e.target.value)} />
          </label>
        </div>
        <div className={s.stats}>
          <div className={`panel ${s.stat}`}>
            <span>MON would be</span>
            <b className="num">{stressed ? `$${stressed.toFixed(5)}` : "…"}</b>
            <small>from ${live?.toFixed(5) ?? "…"} live</small>
          </div>
          <div className={`panel ${s.stat}`}>
            <span>Open policies would pay</span>
            <b className="num">{(stressPay / 1e6).toFixed(2)}</b>
            <small>hhUSD across {open.length} policies</small>
          </div>
          <div className={`panel ${s.stat}`}>
            <span>Pool can pay</span>
            <b className="num">{usd(pool.data?.assets ?? 0n)}</b>
            <small>hhUSD held</small>
          </div>
          <div className={`panel ${s.stat}`}>
            <span>Result</span>
            <b className={stressPay <= assets ? s.ok : s.bad}>{stressPay <= assets ? "Solvent" : "Short"}</b>
            <small>{assets > 0 ? `${((stressPay / assets) * 100).toFixed(2)}% of the pool` : ""}</small>
          </div>
        </div>
        <p className={s.mute}>
          The pool can never be short: each policy&apos;s maximum payout is locked when it is sold. This test shows how much of that lock a
          given crash would actually use.
        </p>
      </section>

      <section className={`panel ${s.card}`}>
        <h2>Delivery contracts with money at stake</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Underlying</th>
                <th>State</th>
                <th>Owed if delivery fails</th>
                <th>Collateral behind it</th>
                <th>Coverage</th>
                <th>Proofs so far</th>
                <th>Evidence policy</th>
              </tr>
            </thead>
            <tbody>
              {live2.map((r) => {
                const owed = r.status.sold * r.terms.payoutPerUnit;
                const locked = (r.status.unsoldReleased ? r.status.sold : r.terms.units) * r.terms.payoutPerUnit;
                const o = oracle.data?.find((x) => x.id === r.id.toString());
                return (
                  <tr key={r.id.toString()}>
                    <td className="num">
                      <Link href={`/app/c/${r.id}`}>{r.id.toString()}</Link>
                    </td>
                    <td>{bytes32Label(r.terms.underlying)}</td>
                    <td>{STATE_LABEL[r.status.state as State]}</td>
                    <td className="num">{usd(owed)}</td>
                    <td className="num">{usd(locked)}</td>
                    <td className={`num ${s.ok}`}>{owed > 0n ? `${(Number(locked) / Number(owed)).toFixed(2)}×` : "no sales"}</td>
                    <td className="num">{o ? `${o.answered} of ${o.issued}, needs ${o.sla?.requiredSolves}` : "…"}</td>
                    <td>2 of 3 signers · 5 min challenge</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!live2.length ? <p className={s.mute}>No delivery contract has money at stake right now.</p> : null}
      </section>

      <section className={`panel ${s.card}`}>
        <h2>Assumptions and limits</h2>
        <ul className={s.list} style={{ display: "grid" }}>
          <li>One operator runs all three oracle signers in this demo.</li>
          <li>A guardian resolves disputes and must act before a deadline, or the contract voids.</li>
          <li>The price pool&apos;s 7% daily volatility is a chosen curve setting, not a forecast.</li>
          <li>Contracts are unaudited and settle in hhUSD, a testnet token with no value.</li>
        </ul>
      </section>
    </main>
  );
}
