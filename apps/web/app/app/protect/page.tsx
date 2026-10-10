"use client";

import { priceProtectionPoolAbi } from "@hyperhedge/sdk";
import { useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { CandleChart, PremiumCurve, StrikeHistogram, type Candle } from "@/components/PriceCharts";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { ORACLE_API, addrLink, deployment, pub, tokenAbi } from "@/lib/chain";
import { usePoll } from "@/lib/data";
import { relative, short, usd } from "@/lib/format";
import s from "./protect.module.css";

const POOL = (process.env.NEXT_PUBLIC_PRICE_POOL ?? "0x4dC4E80DaE43f2149B5E104194522550921A71d9") as Address;
const pool = { address: POOL, abi: priceProtectionPoolAbi } as const;
const DURATIONS = ["1 hour", "6 hours", "24 hours"] as const;
const GRANS = { "5m": "300", "15m": "900", "1h": "3600", "6h": "21600" } as const;
const P8 = 1e8;

type Signed = { report: { feedId: Hex; price: number; publishTime: number }; sigs: Hex[] };

async function loadPool(me?: Address) {
  const [assets, locked, totalShares, vol, next, myShares] = await Promise.all([
    pub.readContract({ ...pool, functionName: "assets" }),
    pub.readContract({ ...pool, functionName: "locked" }),
    pub.readContract({ ...pool, functionName: "totalShares" }),
    pub.readContract({ ...pool, functionName: "volDailyBps" }),
    pub.readContract({ ...pool, functionName: "nextId" }),
    me ? pub.readContract({ ...pool, functionName: "shares", args: [me] }) : 0n,
  ]);
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const positions = await Promise.all(ids.map(async (id) => ({ id, ...(await pub.readContract({ ...pool, functionName: "position", args: [id] })) })));
  return { assets, locked, totalShares, vol, myShares, positions: positions.reverse() };
}

async function loadCandles(g: string): Promise<Candle[]> {
  const r = await fetch(`${ORACLE_API}/price/candles?granularity=${g}`);
  if (!r.ok) throw new Error(`candles HTTP ${r.status}`);
  const rows = (await r.json()) as number[][];
  return rows
    .map(([t, low, high, open, close, volume]) => ({ t: t!, low: low!, high: high!, open: open!, close: close!, volume: volume! }))
    .sort((a, b) => a.t - b.t)
    .slice(-90);
}

async function loadSigned(): Promise<Signed> {
  const r = await fetch(`${ORACLE_API}/price/latest`, { cache: "no-store" });
  if (!r.ok) throw new Error(`price HTTP ${r.status}`);
  return r.json();
}

export default function Protect() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const [gran, setGran] = useState<keyof typeof GRANS>("1h");
  const [notional, setNotional] = useState(100);
  const [dropPct, setDropPct] = useState(5);
  const [dur, setDur] = useState(0);
  const [lpAmount, setLpAmount] = useState("");
  const [view, setView] = useState<bigint>();

  const p = usePoll(() => loadPool(account), 10_000, [account]);
  const price = usePoll(loadSigned, 5_000, []);
  const candles = usePoll(() => loadCandles(GRANS[gran]), 30_000, [gran]);
  const live = price.data ? price.data.report.price / P8 : undefined;
  const strikeBps = Math.round((100 - dropPct) * 100);
  const notional6 = BigInt(Math.max(0, Math.round(notional * 1e6)));

  const quote = usePoll(
    async () => (notional6 > 0n ? pub.readContract({ ...pool, functionName: "quote", args: [notional6, strikeBps, dur] }) : undefined),
    6_000,
    [notional6.toString(), strikeBps, dur, p.data?.locked.toString()],
  );
  const curve = usePoll(
    async () => {
      const [assets, lockedNow] = await Promise.all([
        pub.readContract({ ...pool, functionName: "assets" }),
        pub.readContract({ ...pool, functionName: "locked" }),
      ]);
      const a = Number(assets - lockedNow) / 1e6;
      if (a <= 0) return [];
      const sizes = Array.from({ length: 10 }, (_, i) => Math.max(1, Math.floor(((i + 1) / 10) * a * 0.95)));
      const out = await Promise.all(
        sizes.map(async (size) => {
          try {
            const [prem] = await pub.readContract({ ...pool, functionName: "quote", args: [BigInt(size * 1e6), strikeBps, dur] });
            return { size, per100: (Number(prem) / 1e6 / size) * 100 };
          } catch {
            return undefined;
          }
        }),
      );
      return out.filter((x): x is { size: number; per100: number } => Boolean(x));
    },
    20_000,
    [strikeBps, dur],
  );

  const open = (p.data?.positions ?? []).filter((x) => !x.settled);
  const util = p.data && p.data.assets > 0n ? Number((p.data.locked * 10_000n) / p.data.assets) / 100 : 0;
  const myValue = p.data && p.data.totalShares > 0n ? (p.data.myShares * p.data.assets) / p.data.totalShares : 0n;
  const selected = useMemo(() => (p.data?.positions ?? []).find((x) => x.id === (view ?? p.data?.positions[0]?.id)), [p.data, view]);

  const buy = async () => {
    const signed = await loadSigned();
    const [prem] = await pub.readContract({ ...pool, functionName: "quote", args: [notional6, strikeBps, dur] });
    const maxPremium = (prem * 102n) / 100n; // 2% slippage for the utilization moving under you
    const r = { feedId: signed.report.feedId, price: BigInt(signed.report.price), publishTime: BigInt(signed.report.publishTime) };
    await tx.run([
      { label: "Approve hhUSD for the pool", request: { address: deployment.token, abi: tokenAbi, functionName: "approve", args: [POOL, maxPremium] } },
      { label: "Buy price protection", request: { ...pool, functionName: "buy", args: [notional6, strikeBps, dur, maxPremium, r, signed.sigs] } },
    ]);
  };
  const deposit = () => {
    const amt = BigInt(Math.round(+lpAmount * 1e6));
    return tx.run([
      { label: "Approve hhUSD for the pool", request: { address: deployment.token, abi: tokenAbi, functionName: "approve", args: [POOL, amt] } },
      { label: "Add liquidity", request: { ...pool, functionName: "deposit", args: [amt] } },
    ]);
  };
  const withdrawAll = () => tx.run([{ label: "Withdraw liquidity", request: { ...pool, functionName: "withdraw", args: [p.data!.myShares] } }]);

  return (
    <main className={s.main}>
      <header className={s.head}>
        <div className={s.ticker}>
          <b className="num">{live ? `$${live.toFixed(5)}` : "…"}</b>
          <span>MON / USD</span>
          <small>
            {price.data ? `signed 2 of 3 · chain time ${new Date(price.data.report.publishTime * 1000).toLocaleTimeString("en-GB")}` : price.error ?? "reading the oracle…"} · source Coinbase
          </small>
        </div>
        <dl className={s.poolStats}>
          <div>
            <dt>Pool liquidity</dt>
            <dd className="num">{p.data ? usd(p.data.assets) : "…"}</dd>
          </div>
          <div>
            <dt>Locked for payouts</dt>
            <dd className="num">{p.data ? usd(p.data.locked) : "…"}</dd>
          </div>
          <div>
            <dt>Utilization</dt>
            <dd className="num">{util.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Assumed daily vol</dt>
            <dd className="num">{p.data ? `${p.data.vol / 100}%` : "…"}</dd>
          </div>
          <div>
            <dt>Pool</dt>
            <dd>
              <a href={addrLink(POOL)} target="_blank" rel="noreferrer">
                {short(POOL)}
              </a>
            </dd>
          </div>
        </dl>
      </header>

      <section className={`panel ${s.chartCard}`}>
        <div className={s.tabs}>
          <span className={s.chartTitle}>MON/USD</span>
          {(Object.keys(GRANS) as (keyof typeof GRANS)[]).map((g) => (
            <button key={g} className={gran === g ? s.on : undefined} onClick={() => setGran(g)}>
              {g}
            </button>
          ))}
        </div>
        <CandleChart
          candles={candles.data ?? []}
          live={live}
          quoteStrike={live ? (live * strikeBps) / 10_000 : undefined}
          strikes={open.map((x) => Number(x.strike) / P8)}
        />
      </section>

      <div className={s.cols}>
        <section className={`panel ${s.block}`}>
          <h2>Add liquidity</h2>
          <p className="muted">
            LPs back every policy and earn its premium. Your share is <b className="num">{usd(myValue)}</b> hhUSD.
          </p>
          <div className={s.row2}>
            <label>
              Amount (hhUSD)
              <input inputMode="decimal" value={lpAmount} onChange={(e) => setLpAmount(e.target.value)} placeholder="100" />
            </label>
            {account ? (
              <button className="btn" disabled={!(+lpAmount > 0)} onClick={deposit}>
                Add liquidity
              </button>
            ) : (
              <button className="btn" onClick={connect}>
                Connect wallet
              </button>
            )}
          </div>
          {account && p.data && p.data.myShares > 0n ? (
            <button className="btn quiet" onClick={withdrawAll}>
              Withdraw my unlocked share
            </button>
          ) : null}
          <h3 className={s.sub}>Protection locked by strike</h3>
          <StrikeHistogram positions={open.map((x) => ({ strike: Number(x.strike) / P8, maxPayout: Number(x.maxPayout) }))} live={live} />
        </section>

        <section className={`panel ${s.block}`}>
          <h2>Buy protection</h2>
          <div className={s.row3}>
            <label>
              Cover (hhUSD of MON)
              <input type="number" min={1} value={notional} onChange={(e) => setNotional(Math.max(0, +e.target.value))} />
            </label>
            <label>
              Pays below a drop of
              <select value={dropPct} onChange={(e) => setDropPct(+e.target.value)}>
                {[1, 3, 5, 10, 15, 20, 30].map((d) => (
                  <option key={d} value={d}>
                    {d}%
                  </option>
                ))}
              </select>
            </label>
            <label>
              For
              <select value={dur} onChange={(e) => setDur(+e.target.value)}>
                {DURATIONS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={s.quote}>
            {quote.data ? (
              <>
                Premium <b className="num">{usd(quote.data[0])}</b> hhUSD · pays up to <b className="num">{usd(quote.data[1])}</b> if MON falls
                below <b className="num">{live ? `$${((live * strikeBps) / 10_000).toFixed(5)}` : "…"}</b>
              </>
            ) : (
              <span className="muted">{quote.error ? "Not enough free liquidity for this size." : "Quoting from the pool…"}</span>
            )}
          </p>
          {account ? (
            <button className="btn" disabled={!quote.data || !price.data} onClick={buy}>
              Pay premium and buy
            </button>
          ) : (
            <button className="btn" onClick={connect}>
              Connect wallet
            </button>
          )}
          <TxStatus state={tx.state} />
          <h3 className={s.sub}>Premium curve</h3>
          <PremiumCurve points={curve.data ?? []} />
          <p className={s.note}>
            Rate = assumed vol × √time, less half the drop distance, times (1 + 2u²) for pool utilization u. A disclosed curve, not a
            fair-value model.
          </p>
        </section>
      </div>

      <div className={s.cols}>
        <section className={`panel ${s.block}`}>
          <h2>History</h2>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Who</th>
                  <th>Cover</th>
                  <th>Strike</th>
                  <th>Expiry</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {(p.data?.positions ?? []).map((x) => (
                  <tr key={x.id.toString()} onClick={() => setView(x.id)} className={selected?.id === x.id ? s.sel : undefined}>
                    <td className="num">{x.id.toString()}</td>
                    <td className="num">{account && x.owner.toLowerCase() === account.toLowerCase() ? "You" : short(x.owner)}</td>
                    <td className="num">{usd(x.notional)}</td>
                    <td className="num">${(Number(x.strike) / P8).toFixed(5)}</td>
                    <td className="num">{relative(x.expiry)}</td>
                    <td className="num">
                      {!x.settled ? "open" : x.paid > 0n ? <b className={s.paid}>paid {usd(x.paid)}</b> : x.expiryPrice === 0n ? "lapsed" : "no payout"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`panel ${s.block}`}>
          <h2>Payoff diagram{selected ? ` · #${selected.id}` : ""}</h2>
          {selected ? (
            <Payoff
              spot={Number(selected.spot) / P8}
              strike={Number(selected.strike) / P8}
              notional={Number(selected.notional) / 1e6}
              premium={Number(selected.premium) / 1e6}
              live={live}
              settledAt={selected.settled && selected.expiryPrice > 0n ? Number(selected.expiryPrice) / P8 : undefined}
            />
          ) : (
            <p className="muted">Buy protection to see its payoff.</p>
          )}
        </section>
      </div>
    </main>
  );
}

/** Net result at expiry for one position: notional × (strike − P) / spot − premium, floored at −premium. */
function Payoff({ spot, strike, notional, premium, live, settledAt }: { spot: number; strike: number; notional: number; premium: number; live?: number; settledAt?: number }) {
  const W = 520;
  const H = 240;
  const pad = { l: 46, r: 14, t: 20, b: 30 };
  const lo = strike * 0.6;
  const hi = spot * 1.12;
  const pay = (p: number) => Math.max(0, (notional * (strike - p)) / spot) - premium;
  const maxY = pay(lo);
  const minY = -premium;
  const X = (p: number) => pad.l + ((p - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + ((maxY - v) / (maxY - minY || 1)) * (H - pad.t - pad.b);
  const pts = [lo, strike, hi].map((p) => `${X(p).toFixed(1)},${Y(pay(p)).toFixed(1)}`).join(" ");
  const mark = settledAt ?? live;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Payoff at expiry">
      <polygon points={`${X(lo)},${Y(0)} ${pts} ${X(hi)},${Y(0)}`} className={s.area} />
      <line x1={pad.l} x2={W - pad.r} y1={Y(0)} y2={Y(0)} className={s.zero} />
      <polyline points={pts} className={s.payLine} />
      <text x={X(lo) + 4} y={Y(maxY) - 6} className={s.lbl}>
        +{(maxY).toFixed(2)} if MON → ${lo.toFixed(4)}
      </text>
      <text x={X(strike)} y={Y(pay(strike)) + 16} textAnchor="middle" className={s.lbl}>
        strike ${strike.toFixed(5)}
      </text>
      <text x={X(hi) - 4} y={Y(-premium) - 6} textAnchor="end" className={s.lbl}>
        −{premium.toFixed(3)} premium
      </text>
      {mark ? (
        <g>
          <line x1={X(Math.min(hi, Math.max(lo, mark)))} x2={X(Math.min(hi, Math.max(lo, mark)))} y1={pad.t} y2={H - pad.b} className={s.markLine} />
          <text x={X(Math.min(hi, Math.max(lo, mark))) + (X(Math.min(hi, Math.max(lo, mark))) > W / 2 ? -4 : 4)} y={pad.t + 10} textAnchor={X(Math.min(hi, Math.max(lo, mark))) > W / 2 ? "end" : "start"} className={s.markText}>
            {settledAt ? "settled" : "now"} ${mark.toFixed(5)} → {pay(mark) >= 0 ? "+" : ""}
            {pay(mark).toFixed(3)}
          </text>
        </g>
      ) : null}
      <text x={pad.l} y={H - 8} className={s.lbl}>
        MON price at expiry →
      </text>
    </svg>
  );
}

