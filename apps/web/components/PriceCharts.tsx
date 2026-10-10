"use client";

import s from "./PriceCharts.module.css";

export type Candle = { t: number; low: number; high: number; open: number; close: number; volume: number };

const fmtP = (p: number) => `$${p.toFixed(p < 0.1 ? 5 : 2)}`;

/** Real exchange candles. Overlays: live price, the strike being quoted, strikes of open positions. */
export function CandleChart({ candles, live, quoteStrike, strikes }: { candles: Candle[]; live?: number; quoteStrike?: number; strikes: number[] }) {
  if (!candles.length) return <p className="muted">Loading MON/USD candles from the exchange…</p>;
  const W = 900;
  const H = 320;
  const pad = { l: 64, r: 12, t: 14, b: 26 };
  const vH = 46;
  const lows = candles.map((c) => c.low).concat(quoteStrike ? [quoteStrike] : [], strikes);
  const highs = candles.map((c) => c.high).concat(live ? [live] : []);
  let lo = Math.min(...lows);
  let hi = Math.max(...highs);
  const padY = (hi - lo) * 0.08 || hi * 0.01;
  lo -= padY;
  hi += padY;
  const plotB = H - pad.b - vH - 8;
  const y = (p: number) => pad.t + ((hi - p) / (hi - lo)) * (plotB - pad.t);
  const cw = (W - pad.l - pad.r) / candles.length;
  const vmax = Math.max(...candles.map((c) => c.volume), 1);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="MON/USD candlestick chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={s.grid} />
          <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className={s.tick}>
            {fmtP(t)}
          </text>
        </g>
      ))}
      {candles.map((c, i) => {
        const x = pad.l + i * cw + cw / 2;
        const up = c.close >= c.open;
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        const vh = (c.volume / vmax) * vH;
        return (
          <g key={c.t} className={up ? s.up : s.down}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} strokeWidth="1.2" />
            <rect x={x - cw * 0.32} width={cw * 0.64} y={top} height={Math.max(1, bot - top)} rx="1" />
            <rect x={x - cw * 0.32} width={cw * 0.64} y={H - pad.b - vh} height={vh} className={s.vol} />
          </g>
        );
      })}
      {strikes.map((k, i) => (
        <line key={`${k}-${i}`} x1={pad.l} x2={W - pad.r} y1={y(k)} y2={y(k)} className={s.posStrike} />
      ))}
      {quoteStrike ? (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(quoteStrike)} y2={y(quoteStrike)} className={s.strike} />
          <text x={W - pad.r - 4} y={y(quoteStrike) - 6} textAnchor="end" className={s.strikeLabel}>
            your strike {fmtP(quoteStrike)}
          </text>
        </g>
      ) : null}
      {live ? (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(live)} y2={y(live)} className={s.live} />
          <rect x={W - pad.r - 74} y={y(live) - 10} width="74" height="20" rx="4" className={s.liveTag} />
          <text x={W - pad.r - 37} y={y(live)} textAnchor="middle" dominantBaseline="central" className={s.liveText}>
            {fmtP(live)}
          </text>
        </g>
      ) : null}
      <text x={pad.l} y={H - 8} className={s.tick}>
        {new Date(candles[0]!.t * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </text>
      <text x={W - pad.r} y={H - 8} textAnchor="end" className={s.tick}>
        {new Date(candles.at(-1)!.t * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </text>
    </svg>
  );
}

/**
 * Locked protection by strike, on a log price axis, like a liquidity distribution. Strikes above the live
 * price would pay out if the position expired now.
 */
export function StrikeHistogram({ positions, live }: { positions: { strike: number; maxPayout: number }[]; live?: number }) {
  if (!positions.length || !live) return <p className="muted">No open protection yet. The first buy appears here.</p>;
  const W = 620;
  const H = 280;
  const pad = { l: 16, r: 16, t: 26, b: 30 };
  const lo = Math.log(live * 0.6);
  const hi = Math.log(live * 1.15);
  const x = (p: number) => pad.l + ((Math.log(p) - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const N = 18;
  const buckets = Array.from({ length: N }, (_, i) => ({ from: Math.exp(lo + ((hi - lo) * i) / N), to: Math.exp(lo + ((hi - lo) * (i + 1)) / N), sum: 0 }));
  for (const p of positions) {
    const b = buckets.find((k) => p.strike >= k.from && p.strike < k.to);
    if (b) b.sum += p.maxPayout;
  }
  const max = Math.max(...buckets.map((b) => b.sum), 1);
  const base = H - pad.b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Locked protection by strike price">
      <g className={s.legend}>
        <rect x={pad.l} y={6} width="10" height="10" className={s.itm} />
        <text x={pad.l + 15} y={11} dominantBaseline="central">
          would pay now
        </text>
        <rect x={pad.l + 110} y={6} width="10" height="10" className={s.otm} />
        <text x={pad.l + 125} y={11} dominantBaseline="central">
          out of the money
        </text>
      </g>
      {buckets.map((b) =>
        b.sum > 0 ? (
          <rect
            key={b.from}
            x={x(b.from) + 0.5}
            width={Math.max(1, x(b.to) - x(b.from) - 1)}
            y={base - (b.sum / max) * (base - pad.t - 8)}
            height={(b.sum / max) * (base - pad.t - 8)}
            className={b.from >= live ? s.itm : s.otm}
          >
            <title>{`${fmtP(b.from)}–${fmtP(b.to)}: ${(b.sum / 1e6).toFixed(2)} hhUSD locked`}</title>
          </rect>
        ) : null,
      )}
      <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} className={s.axis} />
      <line x1={x(live)} x2={x(live)} y1={pad.t - 4} y2={base} className={s.liveV} />
      <text x={x(live)} y={pad.t - 8} textAnchor="middle" className={s.liveVText}>
        {fmtP(live)}
      </text>
      {[0.7, 0.8, 0.9, 1].map((f) => (
        <text key={f} x={x(live * f)} y={H - 10} textAnchor="middle" className={s.tick}>
          {fmtP(live * f)}
        </text>
      ))}
    </svg>
  );
}

/** The AMM curve read from the contract: premium per 100 hhUSD of cover as the trade size grows. */
export function PremiumCurve({ points }: { points: { size: number; per100: number }[] }) {
  if (points.length < 2) return <p className="muted">Reading the curve from the pool…</p>;
  const W = 420;
  const H = 280;
  const pad = { l: 48, r: 14, t: 22, b: 30 };
  const maxX = Math.max(...points.map((p) => p.size));
  const maxY = Math.max(...points.map((p) => p.per100)) * 1.1;
  const X = (v: number) => pad.l + (v / maxX) * (W - pad.l - pad.r);
  const Y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.size).toFixed(1)},${Y(p.per100).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Premium curve">
      <text x={pad.l} y={12} className={s.tick}>
        hhUSD premium per 100 covered
      </text>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(maxY * f)} y2={Y(maxY * f)} className={s.grid} />
          <text x={pad.l - 6} y={Y(maxY * f)} textAnchor="end" dominantBaseline="central" className={s.tick}>
            {(maxY * f).toFixed(2)}
          </text>
        </g>
      ))}
      <path d={d} className={s.curve} />
      <text x={pad.l} y={H - 10} className={s.tick}>
        0
      </text>
      <text x={W - pad.r} y={H - 10} textAnchor="end" className={s.tick}>
        {maxX.toLocaleString("en-US")} hhUSD covered
      </text>
    </svg>
  );
}
