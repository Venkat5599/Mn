"use client";

import { State } from "@hyperhedge/sdk";
import { addrLink } from "@/lib/chain";
import { loadContracts, loadOracle, usePoll } from "@/lib/data";
import { short, usd } from "@/lib/format";
import s from "../pages.module.css";

// The demo host is plain HTTP, so the browser reaches it through a same-origin proxy. Other hosts named in an
// SLA are not probed from the viewer's browser at all; their record comes from the oracle's proofs.
const PROXIED: Record<string, string> = { "http://187.127.137.136:9795": "/api/agent/health" };

async function health(host: string) {
  const path = PROXIED[host.replace(/\/$/, "")];
  if (!path) return null;
  const t = Date.now();
  try {
    const j = (await (await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(6_000) })).json()) as { ok?: boolean; cores?: number };
    return { ok: Boolean(j.ok), ms: Date.now() - t, cores: j.cores };
  } catch {
    return { ok: false, ms: Date.now() - t, cores: undefined };
  }
}

export default function Providers() {
  const rows = usePoll(loadContracts, 15_000, []).data ?? [];
  const oracle = usePoll(loadOracle, 15_000, []).data ?? [];

  // Hosts are named in each contract's committed SLA; sellers are the addresses that locked collateral.
  const hosts = new Map<string, { contracts: number; delivered: number; failed: number; proofs: number; issued: number }>();
  for (const o of oracle) {
    if (!o.sla) continue;
    const r = rows.find((x) => x.id.toString() === o.id);
    const h = hosts.get(o.sla.host) ?? { contracts: 0, delivered: 0, failed: 0, proofs: 0, issued: 0 };
    h.contracts++;
    h.proofs += o.answered;
    h.issued += o.issued;
    if (r?.status.state === State.SETTLED) h.failed++;
    if (r && (r.status.state === State.EXPIRED || r.status.state === State.DELIVERED) && r.status.outcome === 2) h.delivered++;
    hosts.set(o.sla.host, h);
  }
  const sellers = new Map<string, { contracts: number; collateral: bigint; premiums: bigint }>();
  for (const r of rows) {
    const k = r.terms.seller;
    const x = sellers.get(k) ?? { contracts: 0, collateral: 0n, premiums: 0n };
    x.contracts++;
    x.collateral += r.terms.units * r.terms.payoutPerUnit;
    x.premiums += r.status.sold * r.terms.premiumPerUnit;
    sellers.set(k, x);
  }
  const live = usePoll(async () => Object.fromEntries(await Promise.all([...hosts.keys()].map(async (h) => [h, await health(h)] as const))), 20_000, [[...hosts.keys()].join()]);

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Provider Registry</h1>
        <p>
          Every compute host named in a contract, with its record built only from verified proofs and final outcomes, and every seller who has
          locked collateral. Track records start at zero; nothing here is self-reported.
        </p>
      </header>

      <section className={`panel ${s.card}`}>
        <h2>Compute hosts</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Host</th>
                <th>Contracts</th>
                <th>Delivered</th>
                <th>Failed</th>
                <th>Proofs verified</th>
                <th>Live now</th>
              </tr>
            </thead>
            <tbody>
              {[...hosts.entries()].map(([h, x]) => {
                const l = live.data?.[h];
                return (
                  <tr key={h}>
                    <td className="mono">{h.replace(/^https?:\/\//, "")}</td>
                    <td className="num">{x.contracts}</td>
                    <td className={`num ${s.ok}`}>{x.delivered}</td>
                    <td className={`num ${x.failed ? s.bad : ""}`}>{x.failed}</td>
                    <td className="num">
                      {x.proofs} of {x.issued}
                    </td>
                    <td>
                      {l === undefined ? (
                        "…"
                      ) : l === null ? (
                        <span className={s.mute}>no public endpoint</span>
                      ) : l.ok ? (
                        <span className={s.ok}>answering · {l.cores} cores · {l.ms} ms</span>
                      ) : (
                        <span className={s.bad}>not answering</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={s.mute}>
          Live status is checked through this site for the demo host. The oracle&apos;s proof record is the authoritative signal for every host.
        </p>
      </section>

      <section className={`panel ${s.card}`}>
        <h2>Sellers</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Contracts issued</th>
                <th>Collateral committed</th>
                <th>Premiums from sales</th>
              </tr>
            </thead>
            <tbody>
              {[...sellers.entries()].map(([a, x]) => (
                <tr key={a}>
                  <td>
                    <a href={addrLink(a)} target="_blank" rel="noreferrer" className="mono">
                      {short(a)}
                    </a>
                  </td>
                  <td className="num">{x.contracts}</td>
                  <td className="num">{usd(x.collateral)}</td>
                  <td className="num">{usd(x.premiums)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
