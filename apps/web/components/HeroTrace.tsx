"use client";

import { useEffect, useState } from "react";
import { Mark } from "./Mark";
import s from "./HeroTrace.module.css";

// One contract, with contract #4's terms: 4 hhUSD premium, 50 hhUSD payout per unit, a proof every 15 s.
const PROOFS = [
  { label: "Challenge 1", ok: true },
  { label: "Challenge 2", ok: true },
  { label: "Challenge 3", ok: false },
];
const LAST = 6; // 0 buy · 1 lock · 2-4 proofs · 5 report · 6 paid

/**
 * One HYPERHEDGE contract, end to end. Ported from Scrappy's Trace: rendered at its final step so every node
 * is visible without JS; on the client it replays step by step. Motion changes tone only, never visibility.
 */
export function HeroTrace() {
  const [step, setStep] = useState(LAST);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = LAST;
    let t = 0;
    const run = () => {
      n = n >= LAST ? 0 : n + 1;
      setStep(n);
      t = window.setTimeout(run, n === LAST ? 3600 : n === 0 ? 1100 : 900);
    };
    t = window.setTimeout(run, 2200);
    return () => window.clearTimeout(t);
  }, []);

  const lit = (n: number) => step >= n;
  const on = (n: number) => String(step === n);

  return (
    <figure className={s.trace} aria-label="Example HYPERHEDGE contract: a buyer is protected, the host misses a proof, the buyer is paid">
      <div className={s.row}>
        <div className={s.node} data-lit={on(0)}>
          <p className={s.faint}>Buyer, an AI team</p>
          <p className={s.body}>Reserved H100 hours for a training run. Protects one unit before the window opens.</p>
          <pre className={s.code}>{`market.buy({
  id: 4,
  units: 1,
  premium: 4,
})`}</pre>
        </div>

        <Wire lit={lit(1)} flowing={step === 1} />

        <div className={`${s.node} ${s.center}`} data-lit={on(1)}>
          <span className={s.brand}>
            <Mark size={24} />
            HYPERHEDGE
          </span>
          <p className={s.soft}>The seller&apos;s 50 hhUSD payout is already locked in the vault. Proofs are seeded by fresh Monad blocks.</p>
        </div>

        <Wire lit={lit(2)} flowing={step >= 2 && step <= 4} />

        <ul className={s.proofs}>
          {PROOFS.map((p, i) => {
            const done = lit(2 + i);
            return (
              <li key={p.label} className={s.node} data-lit={on(2 + i)}>
                <span className={s.tick} data-state={done ? (p.ok ? "ok" : "miss") : "wait"} aria-hidden="true" />
                <span className={s.soft}>{p.label}</span>
                <b className={done ? s.ink : s.faint}>{done ? (p.ok ? "proven" : "missed") : "waiting"}</b>
              </li>
            );
          })}
        </ul>

        <Wire lit={lit(5)} flowing={step === 5} />

        <div className={`${s.node} ${s.result}`} data-lit={on(5)}>
          <p className={s.faint}>Signed onchain, 2 of 3</p>
          <pre className={s.json}>{`{ "verdict": "FAILURE",
  "signers": 2,
  "dispute": "5 min" }`}</pre>
          <p className={`${s.big} ${lit(6) ? s.ink : s.faint}`}>Host under-delivered.</p>
          <p className={`${s.paid} ${lit(6) ? s.money : s.faint}`}>+50 hhUSD to the buyer</p>
        </div>
      </div>
      <figcaption className={s.caption}>Example contract, in the exact shape it settles on Monad. Live numbers are further down.</figcaption>
    </figure>
  );
}

function Wire({ lit, flowing }: { lit: boolean; flowing: boolean }) {
  return (
    <div className={s.wire} aria-hidden="true">
      <svg viewBox="0 0 40 16">
        <path d="M2 8h30" className={flowing ? s.pulse : undefined} data-lit={String(lit)} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M28 3.5 34 8l-6 4.5" data-lit={String(lit)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}
