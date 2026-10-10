"use client";

import { State } from "@hyperhedge/sdk";
import { loadContracts, loadOracle, usePoll } from "@/lib/data";
import { usd } from "@/lib/format";
import { loadEvents, loadPoolState } from "@/lib/pool";
import s from "../pages.module.css";

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className={`panel ${s.stat}`}>
      <span>{k}</span>
      <b className="num">{v}</b>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

export default function Analytics() {
  const rows = usePoll(loadContracts, 15_000, []).data ?? [];
  const oracle = usePoll(loadOracle, 15_000, []).data ?? [];
  const pool = usePoll(loadPoolState, 15_000, []).data;
  const ev = usePoll(() => loadEvents(undefined, 500), 15_000, []).data;

  const sold = rows.reduce((n, r) => n + r.status.sold, 0n);
  const premiums = rows.reduce((n, r) => n + r.status.sold * r.terms.premiumPerUnit, 0n);
  const covered = rows.reduce((n, r) => n + r.status.sold * r.terms.payoutPerUnit, 0n);
  const failures = rows.filter((r) => r.status.state === State.SETTLED);
  const delivered = rows.filter((r) => r.status.state === State.EXPIRED || r.status.state === State.DELIVERED);
  const proofs = oracle.reduce((n, o) => n + o.answered, 0);
  const issued = oracle.reduce((n, o) => n + o.issued, 0);
  const poolPremiums = (pool?.positions ?? []).reduce((n, p) => n + p.premium, 0n);
  const poolCover = (pool?.positions ?? []).reduce((n, p) => n + p.notional, 0n);
  const poolPaid = (pool?.positions ?? []).reduce((n, p) => n + p.paid, 0n);

  // events per day, from the chain index
  const byDay = new Map<string, number>();
  for (const e of ev?.events ?? []) if (e.ts) byDay.set(new Date(e.ts * 1000).toISOString().slice(0, 10), (byDay.get(new Date(e.ts * 1000).toISOString().slice(0, 10)) ?? 0) + 1);
  const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const maxDay = Math.max(1, ...days.map(([, n]) => n));

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Protocol Analytics</h1>
        <p>Totals since launch on Monad testnet, each one counted from contract state. Premiums, cover and payouts are kept separate on purpose.</p>
      </header>

      <h2 style={{ margin: "6px 0 0", fontSize: 17 }}>Delivery protection</h2>
      <div className={s.stats}>
        <Stat k="Contracts issued" v={String(rows.length)} />
        <Stat k="Units of protection sold" v={sold.toString()} />
        <Stat k="Premiums paid" v={usd(premiums)} sub="hhUSD" />
        <Stat k="Maximum cover sold" v={usd(covered)} sub="hhUSD" />
        <Stat k="Delivered" v={String(delivered.length)} />
        <Stat k="Failed and paid out" v={String(failures.length)} />
        <Stat k="Proofs of work verified" v={proofs.toLocaleString("en-US")} sub={`${issued} challenges issued`} />
        <Stat k="Proof success rate" v={issued ? `${((proofs / issued) * 100).toFixed(1)}%` : "…"} />
      </div>

      <h2 style={{ margin: "6px 0 0", fontSize: 17 }}>Price protection</h2>
      <div className={s.stats}>
        <Stat k="Policies sold" v={String(pool?.positions.length ?? "…")} />
        <Stat k="Cover written" v={usd(poolCover)} sub="hhUSD of MON" />
        <Stat k="Premiums earned by LPs" v={usd(poolPremiums)} sub="hhUSD" />
        <Stat k="Paid to buyers" v={usd(poolPaid)} sub="hhUSD" />
      </div>

      <section className={`panel ${s.card}`}>
        <h2>Onchain events per day</h2>
        {days.length ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
            {days.map(([d, n]) => (
              <div key={d} style={{ flex: 1, display: "grid", gap: 6, justifyItems: "center" }} title={`${d}: ${n} events`}>
                <span className="num" style={{ fontSize: 12 }}>
                  {n}
                </span>
                <div style={{ width: "100%", maxWidth: 48, height: (n / maxDay) * 110, background: "#3f66f0", borderRadius: 4 }} />
                <span className={s.mute} style={{ fontSize: 11 }}>
                  {d.slice(5)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.mute}>Reading the event index…</p>
        )}
      </section>
    </main>
  );
}
