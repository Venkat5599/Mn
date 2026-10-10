"use client";

import { useEffect, useState } from "react";
import { deployment } from "@/lib/chain";
import { short } from "@/lib/format";
import { DEFAULT_PREFS, getPrefs, savePrefs, type Prefs } from "@/lib/settings";
import s from "../pages.module.css";

export default function Settings() {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  const [note, setNote] = useState(" ");
  useEffect(() => setP(getPrefs()), []);
  const save = (next: Prefs) => {
    setP(next);
    setNote(savePrefs(next) ? "Saved. Applies on the next page load." : "Your browser blocks storage; this applies to this visit only.");
  };

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Settings</h1>
        <p>Saved in this browser only. Every option here changes how the app behaves.</p>
      </header>

      <section className={`panel ${s.card}`} style={{ maxWidth: 680 }}>
        <h2>Trading</h2>
        <label>
          Price-protection slippage allowance <b className="num">{p.slippagePct}%</b>
          <input type="range" min={0.5} max={10} step={0.5} value={p.slippagePct} onChange={(e) => save({ ...p, slippagePct: +e.target.value })} />
        </label>
        <div className={s.row}>
          <label>
            Default protected drop
            <select value={p.dropPct} onChange={(e) => save({ ...p, dropPct: +e.target.value })}>
              {[1, 3, 5, 10, 15, 20, 30].map((d) => (
                <option key={d} value={d}>
                  {d}%
                </option>
              ))}
            </select>
          </label>
          <label>
            Default protection length
            <select value={p.durationIdx} onChange={(e) => save({ ...p, durationIdx: +e.target.value as Prefs["durationIdx"] })}>
              <option value={0}>1 hour</option>
              <option value={1}>6 hours</option>
              <option value={2}>24 hours</option>
            </select>
          </label>
        </div>
      </section>

      <section className={`panel ${s.card}`} style={{ maxWidth: 680 }}>
        <h2>Display</h2>
        <label>
          Live data refresh
          <select value={p.refreshFactor} onChange={(e) => save({ ...p, refreshFactor: +e.target.value })}>
            <option value={0.5}>Fast (twice as often)</option>
            <option value={1}>Normal</option>
            <option value={2}>Saver (half as often)</option>
          </select>
        </label>
        <label>
          Markets list shows by default
          <select value={p.marketsFilter} onChange={(e) => save({ ...p, marketsFilter: e.target.value as Prefs["marketsFilter"] })}>
            <option value="all">All contracts</option>
            <option value="live">Open and active</option>
            <option value="review">In review or disputed</option>
            <option value="done">Settled, delivered, expired</option>
          </select>
        </label>
        <p className={s.mute}>{note}</p>
        <button className="btn quiet" style={{ justifySelf: "start" }} onClick={() => save(DEFAULT_PREFS)}>
          Reset to defaults
        </button>
      </section>

      <section className={`panel ${s.card}`} style={{ maxWidth: 680 }}>
        <h2>Network</h2>
        <ul className={s.list}>
          <li>
            <span>Chain</span>
            <b>Monad testnet (10143)</b>
          </li>
          <li>
            <span>Market contract</span>
            <b className="mono">{short(deployment.market, 6)}</b>
          </li>
          <li>
            <span>Stake token</span>
            <b>hhUSD, test only</b>
          </li>
        </ul>
      </section>
    </main>
  );
}
