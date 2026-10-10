"use client";

import { useState } from "react";
import { txLink } from "@/lib/chain";
import { usePoll } from "@/lib/data";
import { short, usd, when } from "@/lib/format";
import { loadEvents, type IndexedEvent } from "@/lib/pool";
import s from "../pages.module.css";

const SOURCES = { "": "All contracts", market: "Delivery market", vault: "Collateral vault", pool: "Price protection pool" } as const;
const MONEY = new Set(["amount", "premium", "paid", "payable_", "bond", "net", "fee", "released", "maxPayout", "notional", "units"]);

function describe(e: IndexedEvent) {
  const a = e.args;
  const bits = Object.entries(a)
    .filter(([k]) => !["terms", "t", "sigs"].includes(k))
    .slice(0, 4)
    .map(([k, v]) => {
      if (/^0x[0-9a-fA-F]{40}$/.test(v)) return `${k} ${short(v)}`;
      if (/^0x[0-9a-fA-F]{64}$/.test(v)) return `${k} ${short(v, 6)}`;
      if (MONEY.has(k) && /^\d+$/.test(v) && k !== "units") return `${k} ${usd(BigInt(v))}`;
      return `${k} ${v.length > 24 ? `${v.slice(0, 24)}…` : v}`;
    });
  return bits.join(" · ");
}

export default function Activity() {
  const [source, setSource] = useState<keyof typeof SOURCES>("");
  const ev = usePoll(() => loadEvents(source || undefined, 400), 8_000, [source]);
  const list = ev.data?.events ?? [];
  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Activity &amp; Audit Log</h1>
        <p>Every event the HYPERHEDGE contracts have emitted on Monad testnet, read from the chain and linked to its transaction.</p>
      </header>
      <section className={`panel ${s.card}`}>
        <div className={s.row}>
          <label>
            Contract
            <select value={source} onChange={(e) => setSource(e.target.value as keyof typeof SOURCES)}>
              {Object.entries(SOURCES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <p className={s.mute}>{ev.data ? `${ev.data.total} events indexed` : ev.error ?? "Reading the index…"}</p>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Contract</th>
                <th>Event</th>
                <th>Details</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={`${e.tx}-${e.name}-${e.block}-${describe(e)}`}>
                  <td className="num">{e.ts ? when(e.ts) : `block ${e.block}`}</td>
                  <td>{e.source}</td>
                  <td>
                    <b>{e.name}</b>
                  </td>
                  <td className={s.mute}>{describe(e)}</td>
                  <td>
                    <a href={txLink(e.tx)} target="_blank" rel="noreferrer" className="mono">
                      {short(e.tx)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
