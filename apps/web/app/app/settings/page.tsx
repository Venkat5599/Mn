"use client";

import { useEffect, useState } from "react";
import { deployment } from "@/lib/chain";
import { short } from "@/lib/format";
import s from "../pages.module.css";

const KEY = "hyperhedge.settings";
type Prefs = { slippagePct: number };
const DEFAULTS: Prefs = { slippagePct: 2 };

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings() {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  useEffect(() => setP(read()), []);
  const save = (next: Prefs) => {
    setP(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // storage blocked (private window): settings apply for this visit only
    }
  };

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Settings</h1>
        <p>Saved in this browser only.</p>
      </header>
      <section className={`panel ${s.card}`} style={{ maxWidth: 640 }}>
        <label>
          Price-protection slippage allowance <b className="num">{p.slippagePct}%</b>
          <input type="range" min={0.5} max={10} step={0.5} value={p.slippagePct} onChange={(e) => save({ ...p, slippagePct: +e.target.value })} />
        </label>
        <p className={s.mute}>{saved ? "Saved." : " "}</p>
      </section>
      <section className={`panel ${s.card}`} style={{ maxWidth: 640 }}>
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
