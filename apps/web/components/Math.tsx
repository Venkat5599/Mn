"use client";

import { useId, useState } from "react";
import { pct, usd } from "@/lib/format";
import s from "./Math.module.css";

/**
 * Binary protection payoff. Buyer: M − P on a verified failure, −P otherwise. The seller mirrors it.
 * Drawn from the contract's actual premium and payout, per unit.
 */
export function Payoff({ premium, payout }: { premium: bigint; payout: bigint }) {
  const M = Number(payout) / 1e6;
  const P = Number(premium) / 1e6;
  const W = 520;
  const H = 220;
  const pad = { l: 64, r: 16, t: 18, b: 34 };
  const max = Math.max(M - P, P) * 1.15;
  const y = (v: number) => pad.t + ((max - v) / (2 * max)) * (H - pad.t - pad.b);
  const x0 = pad.l;
  const x1 = (W - pad.l - pad.r) / 2 + pad.l;
  const x2 = W - pad.r;
  const bar = (x: number, v: number, cls: string, label: string) => {
    const top = Math.min(y(v), y(0));
    const h = Math.abs(y(v) - y(0));
    return (
      <g>
        <rect x={x + 26} y={top} width={x1 - x0 - 52} height={Math.max(h, 1)} rx="4" className={cls} />
        <text x={x + (x1 - x0) / 2} y={v >= 0 ? top - 6 : top + h + 14} textAnchor="middle" className={s.val}>
          {label}
        </text>
      </g>
    );
  };
  return (
    <figure className={s.fig}>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Payoff per unit for the buyer">
        <line x1={pad.l} x2={x2} y1={y(0)} y2={y(0)} className={s.axis} />
        <text x={pad.l - 10} y={y(0)} textAnchor="end" dominantBaseline="central" className={s.tick}>
          0
        </text>
        {bar(x0, M - P, s.gain, `+${fmt(M - P)}`)}
        {bar(x1, -P, s.loss, `−${fmt(P)}`)}
        <text x={x0 + (x1 - x0) / 2} y={H - 10} textAnchor="middle" className={s.tick}>
          Verified failure
        </text>
        <text x={x1 + (x2 - x1) / 2} y={H - 10} textAnchor="middle" className={s.tick}>
          Delivered or no report
        </text>
      </svg>
      <figcaption className={s.cap}>
        Buyer, per unit: net <span className="num">M − P = {fmt(M - P)}</span> on a failure, <span className="num">−P = −{fmt(P)}</span> otherwise.
        The seller holds the opposite side, fully collateralized.
      </figcaption>
    </figure>
  );
}

/**
 * Expected-value calculator. q is the user's own estimate: HYPERHEDGE has no historical failure data and
 * does not pretend to. Shows E[payout] = qM, the margin P − qM, and the break-even q* = P / M.
 */
export function Calculator({ premium, payout }: { premium?: bigint; payout?: bigint }) {
  const [q, setQ] = useState(0.1);
  const [M, setM] = useState(payout ? Number(payout) / 1e6 : 1000);
  const [P, setP] = useState(premium ? Number(premium) / 1e6 : 100);
  const id = useId();
  const expected = q * M;
  const margin = P - expected;
  const breakeven = M > 0 ? P / M : 0;
  return (
    <div className={s.calc}>
      <div className={s.inputs}>
        <label htmlFor={`${id}q`}>
          Your estimate of failure probability <b className="num">{pct(q, 0)}</b>
          <input id={`${id}q`} type="range" min={0.01} max={0.5} step={0.01} value={q} onChange={(e) => setQ(+e.target.value)} />
        </label>
        <label htmlFor={`${id}m`}>
          Maximum payout M
          <input id={`${id}m`} type="number" min={1} value={M} onChange={(e) => setM(Math.max(0, +e.target.value))} />
        </label>
        <label htmlFor={`${id}p`}>
          Premium P
          <input id={`${id}p`} type="number" min={0} value={P} onChange={(e) => setP(Math.max(0, +e.target.value))} />
        </label>
      </div>
      <dl className={s.out}>
        <div>
          <dt>Expected payout qM</dt>
          <dd className="num">{fmt(expected)}</dd>
        </div>
        <div>
          <dt>Premium less expected payout</dt>
          <dd className={`num ${margin >= 0 ? s.pos : s.neg}`}>
            {margin >= 0 ? "+" : "−"}
            {fmt(Math.abs(margin))}
          </dd>
        </div>
        <div>
          <dt>Break-even probability P / M</dt>
          <dd className="num">{pct(breakeven)}</dd>
        </div>
      </dl>
      <p className={s.note}>
        A seller expects to profit only if the true failure rate is below <span className="num">{pct(breakeven)}</span>, before capital
        costs. Inputs are yours, not market data: there is no failure history yet to calibrate q against.
      </p>
    </div>
  );
}

/** Per-contract collateral against what it could owe. Fully collateralized contracts sit at exactly 1.0×. */
export function CoverageBars({
  rows,
}: {
  rows: { id: bigint; reserved: bigint; liability: bigint; state: string }[];
}) {
  const live = rows.filter((r) => r.liability > 0n || r.reserved > 0n);
  if (live.length === 0) return <p className="muted">No contract has collateral locked right now.</p>;
  const max = live.reduce((m, r) => (r.reserved > m ? r.reserved : r.liability > m ? r.liability : m), 1n);
  return (
    <div className={s.bars}>
      {live.map((r) => {
        const ratio = r.liability > 0n ? Number((r.reserved * 100n) / r.liability) / 100 : null;
        return (
          <div key={r.id.toString()} className={s.barRow}>
            <span className="num">#{r.id.toString()}</span>
            <div className={s.track}>
              <div className={s.reserved} style={{ width: `${(Number(r.reserved) / Number(max)) * 100}%` }} />
              <div className={s.liab} style={{ width: `${(Number(r.liability) / Number(max)) * 100}%` }} />
            </div>
            <span className="num">{ratio === null ? "no sales" : `${ratio.toFixed(2)}×`}</span>
          </div>
        );
      })}
      <p className={s.legend}>
        <i className={s.kReserved} /> collateral reserved <i className={s.kLiab} /> maximum payout owed to buyers
      </p>
    </div>
  );
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));
export { usd };
