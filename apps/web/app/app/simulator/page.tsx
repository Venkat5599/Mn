"use client";

import { useState } from "react";
import s from "../pages.module.css";

/**
 * Same payout rules as the contracts, run forward over a season of contracts. Inputs are the user's own;
 * nothing here is a forecast or market data.
 */
export default function Simulator() {
  const [n, setN] = useState(20);
  const [payout, setPayout] = useState(100);
  const [premium, setPremium] = useState(8);
  const [failPct, setFailPct] = useState(5);
  const [bond, setBond] = useState(10);
  const [frivolousPct, setFrivolousPct] = useState(0);

  const fails = Math.round((n * failPct) / 100);
  const frivolous = Math.round((fails * frivolousPct) / 100);
  const buyerNet = fails * payout - n * premium;
  const sellerNet = n * premium - fails * payout - frivolous * (payout * bond) / 100;
  const capital = payout; // collateral per contract, reused once each contract settles
  const sellerReturn = sellerNet / (capital * n);
  const breakeven = premium / payout;

  const cols = [
    { k: "Buyer pays in premiums", v: n * premium },
    { k: "Buyer receives in payouts", v: fails * payout },
    { k: "Seller loses in disputed bonds", v: frivolous * (payout * bond) / 100 },
  ];

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Strategy Simulator</h1>
        <p>
          Run a season of delivery contracts through the protocol&apos;s exact payout rules and see who comes out ahead. The failure rate is
          your assumption: there is no history yet to calibrate it.
        </p>
      </header>
      <div className={s.two}>
        <section className={`panel ${s.card}`}>
          <h2>Inputs</h2>
          <label>
            Contracts in the season <b className="num">{n}</b>
            <input type="range" min={1} max={200} value={n} onChange={(e) => setN(+e.target.value)} />
          </label>
          <label>
            Delivery failure rate (your estimate) <b className="num">{failPct}%</b>
            <input type="range" min={0} max={50} value={failPct} onChange={(e) => setFailPct(+e.target.value)} />
          </label>
          <div className={s.row}>
            <label>
              Payout per contract (hhUSD)
              <input type="number" min={1} value={payout} onChange={(e) => setPayout(Math.max(1, +e.target.value))} />
            </label>
            <label>
              Premium per contract (hhUSD)
              <input type="number" min={0} value={premium} onChange={(e) => setPremium(Math.max(0, +e.target.value))} />
            </label>
          </div>
          <label>
            Failures the seller disputes and loses <b className="num">{frivolousPct}%</b> · bond {bond}% of payout
            <input type="range" min={0} max={100} value={frivolousPct} onChange={(e) => setFrivolousPct(+e.target.value)} />
          </label>
          <label>
            Dispute bond (% of payout)
            <input type="number" min={1} max={100} value={bond} onChange={(e) => setBond(Math.min(100, Math.max(1, +e.target.value)))} />
          </label>
        </section>
        <section className={`panel ${s.card}`}>
          <h2>Result over {n} contracts</h2>
          <div className={s.stats}>
            <div className={`panel ${s.stat}`}>
              <span>Failures</span>
              <b className="num">{fails}</b>
            </div>
            <div className={`panel ${s.stat}`}>
              <span>Buyer net</span>
              <b className={`num ${buyerNet >= 0 ? s.ok : s.bad}`}>{buyerNet >= 0 ? "+" : ""}{buyerNet.toLocaleString("en-US")}</b>
              <small>hhUSD</small>
            </div>
            <div className={`panel ${s.stat}`}>
              <span>Seller net</span>
              <b className={`num ${sellerNet >= 0 ? s.ok : s.bad}`}>{sellerNet >= 0 ? "+" : ""}{sellerNet.toLocaleString("en-US")}</b>
              <small>{(sellerReturn * 100).toFixed(1)}% on collateral</small>
            </div>
            <div className={`panel ${s.stat}`}>
              <span>Break-even failure rate</span>
              <b className="num">{(breakeven * 100).toFixed(1)}%</b>
              <small>premium ÷ payout</small>
            </div>
          </div>
          <ul className={s.list}>
            {cols.map((c) => (
              <li key={c.k}>
                <span>{c.k}</span>
                <b className="num">{c.v.toLocaleString("en-US")} hhUSD</b>
              </li>
            ))}
          </ul>
          <p className={s.mute}>
            Buyers come out ahead when real failures exceed {(breakeven * 100).toFixed(1)}% of contracts; sellers when they stay below it.
            A seller who disputes a valid failure still pays the payout and also loses the bond.
          </p>
        </section>
      </div>
    </main>
  );
}
