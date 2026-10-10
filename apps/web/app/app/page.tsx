"use client";

import { STATE_LABEL, State, challengeValid, type ChallengeRecord } from "@hyperhedge/sdk";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Calculator, CoverageBars, Payoff } from "@/components/Math";
import { loadContracts, loadOracle, loadOracleContract, loadVault, usePoll, type ContractRow } from "@/lib/data";
import { bytes32Label, relative, usd } from "@/lib/format";
import s from "./markets.module.css";

const TABS = ["Proofs", "Collateral", "Payoff", "Expected value"] as const;
const FILTERS = { all: "All contracts", live: "Open and active", review: "In review or disputed", done: "Settled, delivered, expired" } as const;

export default function MarketsPage() {
  return (
    <Suspense>
      <Markets />
    </Suspense>
  );
}

function Markets() {
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const rows = usePoll(loadContracts, 4_000, []);
  const oracle = usePoll(loadOracle, 5_000, []);
  const vault = usePoll(loadVault, 8_000, []);
  const [picked, setPicked] = useState<string>();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Proofs");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("all");
  const all = rows.data ?? [];
  const sel = all.find((r) => r.id.toString() === picked) ?? all.find((r) => r.status.state === State.ACTIVE) ?? all[0];
  const live = usePoll(async () => (sel ? loadOracleContract(sel.id) : undefined), 3_000, [sel?.id.toString()]);
  const now = Date.now() / 1000;

  const shown = all.filter((r) => {
    const st = r.status.state as State;
    const okFilter =
      filter === "all" ||
      (filter === "live" && (st === State.OPEN || st === State.ACTIVE)) ||
      (filter === "review" && (st === State.REVIEW || st === State.DISPUTED)) ||
      (filter === "done" && st >= State.DELIVERED);
    const okQ = !q || r.id.toString() === q.replace("#", "") || bytes32Label(r.terms.underlying).toLowerCase().includes(q);
    return okFilter && okQ;
  });

  return (
    <main className={s.main}>
      <h1 className={s.title}>Markets</h1>

      {sel ? (
        <section className={`panel ${s.strip}`}>
          <div className={s.pair}>
            <b className="num">{usd(sel.terms.premiumPerUnit)}</b>
            <span>
              #{sel.id.toString()} {bytes32Label(sel.terms.underlying)}
            </span>
            <small>premium per unit · hhUSD</small>
          </div>
          <Stat k="Payout / unit" v={usd(sel.terms.payoutPerUnit)} />
          <Stat k="Collateral locked" v={usd(sel.terms.units * sel.terms.payoutPerUnit)} />
          <Stat k="Sold" v={`${sel.status.sold} / ${sel.terms.units}`} />
          <Stat k="State" v={STATE_LABEL[sel.status.state as State]} tone={tone(sel.status.state as State)} />
          <Stat k="Deadline" v={relative(sel.terms.deliveryDeadline, now)} />
          <Stat k="Vault" v={vault.data ? (vault.data.reconciled ? "reconciles" : "mismatch") : "…"} tone={vault.data?.reconciled ? "up" : "down"} />
        </section>
      ) : null}

      <section className={`panel ${s.chart}`}>
        <div className={s.tabs} role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? s.on : undefined} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          {sel ? (
            <Link href={`/app/c/${sel.id}`} className={s.open}>
              Open contract #{sel.id.toString()}
            </Link>
          ) : null}
        </div>
        <div className={s.chartBody}>
          {!sel ? (
            <p className="muted">{rows.error ?? "Reading the market from Monad testnet…"}</p>
          ) : tab === "Proofs" ? (
            <ProofBars id={sel.id} challenges={live.data?.challenges ?? []} bits={live.data?.sla?.difficultyBits ?? 20} required={live.data?.sla?.requiredSolves} withinMs={(live.data?.sla?.answerWithinSec ?? 10) * 1000} />
          ) : tab === "Collateral" ? (
            <CoverageBars rows={all.map((r) => ({ id: r.id, reserved: lockedOf(r), liability: liabilityOf(r), state: "" }))} />
          ) : tab === "Payoff" ? (
            <Payoff premium={sel.terms.premiumPerUnit} payout={sel.terms.payoutPerUnit} />
          ) : (
            <Calculator key={sel.id.toString()} premium={sel.terms.premiumPerUnit} payout={sel.terms.payoutPerUnit} />
          )}
        </div>
      </section>

      <div className={s.listHead}>
        <select value={filter} onChange={(e) => setFilter(e.target.value as keyof typeof FILTERS)} aria-label="Filter contracts">
          {Object.entries(FILTERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {q ? <span className="muted">matching “{q}”</span> : null}
        <Link href="/app/issue" className="btn">
          Issue protection
        </Link>
      </div>

      <section className={s.rows}>
        {shown.map((r) => {
          const o = oracle.data?.find((x) => x.id === r.id.toString());
          const need = o?.sla?.requiredSolves ?? 0;
          const slots = o?.sla ? Math.max(1, Math.floor((o.windowEnd - o.windowStart - o.sla.answerWithinSec) / o.sla.intervalSec) + 1) : 1;
          const st = r.status.state as State;
          return (
            <article key={r.id.toString()} className={`panel ${s.row} ${sel?.id === r.id ? s.rowSel : ""}`} onClick={() => setPicked(r.id.toString())}>
              <div className={s.rowName}>
                <Link href={`/app/c/${r.id}`} onClick={(e) => e.stopPropagation()}>
                  #{r.id.toString()} {bytes32Label(r.terms.underlying)}
                </Link>
                <span className={`${s.tag} ${s[tone(st)]}`}>{STATE_LABEL[st]}</span>
              </div>
              <Cell k="Type" v="Protection" />
              <Cell k="Units" v={`${r.status.sold} / ${r.terms.units}`} />
              <Cell k="Premium" v={usd(r.terms.premiumPerUnit)} />
              <Cell k="Payout" v={usd(r.terms.payoutPerUnit)} />
              <Cell k="Deadline" v={relative(r.terms.deliveryDeadline, now)} />
              <div className={s.prog}>
                <div className={s.progLabels}>
                  <span className="num">{o ? `${o.answered} proven` : "no oracle data"}</span>
                  <span className="num">needs {need || "…"}</span>
                  <span className="num">{slots} slots</span>
                </div>
                <div className={s.track}>
                  <i className={s.fill} style={{ width: `${o ? Math.min(100, (o.answered / slots) * 100) : 0}%` }} />
                  <i className={s.miss} style={{ left: `${o ? (o.answered / slots) * 100 : 0}%`, width: `${o ? ((o.issued - o.answered) / slots) * 100 : 0}%` }} />
                  {need ? <i className={s.need} style={{ left: `${(need / slots) * 100}%` }} /> : null}
                </div>
              </div>
            </article>
          );
        })}
        {all.length > 0 && shown.length === 0 ? <p className="muted">No contracts match.</p> : null}
      </section>
    </main>
  );
}

/** One bar per challenge: height is the host's answer time; red is a missed or invalid proof. */
function ProofBars({ id, challenges, bits, required, withinMs }: { id: bigint; challenges: ChallengeRecord[]; bits: number; required?: number; withinMs: number }) {
  if (!challenges.length) return <p className="muted">No challenges issued yet. They start when the delivery window opens.</p>;
  const W = 900;
  const H = 260;
  const pad = { l: 52, r: 12, t: 12, b: 28 };
  const bw = (W - pad.l - pad.r) / challenges.length;
  const y = (ms: number) => pad.t + (1 - Math.min(ms, withinMs) / withinMs) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(withinMs * f));
  const proven = challenges.filter((c) => challengeValid(c, id, bits)).length;
  return (
    <figure className={s.fig}>
      <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Answer time per challenge">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={s.grid} />
            <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className={s.tick}>
              {t >= 1000 ? `${t / 1000}s` : `${t}ms`}
            </text>
          </g>
        ))}
        {challenges.map((c, i) => {
          const ok = challengeValid(c, id, bits);
          const ms = c.answeredAt ? c.answeredAt - c.issuedAt : withinMs;
          const top = ok ? y(ms) : pad.t;
          return (
            <rect key={c.index} x={pad.l + i * bw + bw * 0.18} width={bw * 0.64} y={top} height={H - pad.b - top} rx="2" className={ok ? s.up : s.down}>
              <title>{`challenge ${c.index + 1}: ${ok ? `proof in ${ms} ms` : "missed"}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className={s.cap}>
        <span>
          <i className={s.kUp} /> proof answered, bar = time taken
        </span>
        <span>
          <i className={s.kDown} /> missed or invalid
        </span>
        <span className="num">
          {proven} proven{required ? ` · ${required} required` : ""} · 2^{bits} hashes each
        </span>
      </figcaption>
    </figure>
  );
}

function Stat({ k, v, tone: t }: { k: string; v: string; tone?: string }) {
  return (
    <div className={s.stat}>
      <span>{k}</span>
      <b className={`num ${t ? s[t] : ""}`}>{v}</b>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className={s.cell}>
      <span>{k}</span>
      <b className="num">{v}</b>
    </div>
  );
}

function tone(st: State): "up" | "down" | "warn" | "info" | "dim" {
  if (st === State.DELIVERED || st === State.EXPIRED) return "up";
  if (st === State.SETTLED) return "down";
  if (st === State.REVIEW || st === State.DISPUTED) return "warn";
  if (st === State.OPEN || st === State.ACTIVE) return "info";
  return "dim";
}

const terminal = (r: ContractRow) => r.status.state >= State.SETTLED;
const lockedOf = (r: ContractRow) => (terminal(r) ? 0n : (r.status.unsoldReleased ? r.status.sold : r.terms.units) * r.terms.payoutPerUnit);
const liabilityOf = (r: ContractRow) => (terminal(r) ? 0n : r.status.sold * r.terms.payoutPerUnit);
