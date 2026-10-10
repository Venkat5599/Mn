"use client";

import { State } from "@hyperhedge/sdk";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { ProofTape } from "@/components/ProofTape";
import { addrLink, deployment, txLink } from "@/lib/chain";
import { loadContracts, loadOracleContract, usePoll } from "@/lib/data";
import { bytes32Label, short, usd } from "@/lib/format";
import s from "./landing.module.css";

export default function Landing() {
  const rows = usePoll(loadContracts, 6_000, []).data ?? [];
  const live = rows.find((r) => r.status.state === State.ACTIVE) ?? rows[0];
  const settled = rows.find((r) => r.status.state === State.SETTLED);
  const tape = usePoll(async () => (live ? loadOracleContract(live.id) : undefined), 4_000, [live?.id.toString()]).data;
  const proof = usePoll(async () => (settled ? loadOracleContract(settled.id) : undefined), 30_000, [settled?.id.toString()]).data;

  return (
    <div className={s.page}>
      <header className={`wrap ${s.top}`}>
        <Link href="/" className={s.brand}>
          <Mark size={22} />
          <span>HYPERHEDGE</span>
        </Link>
        <Link href="/app" className={s.open}>
          Open the app
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M4 10 10 4M5 4h5v5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </header>

      <section className={`wrap ${s.hero}`}>
        <h1>
          GPU capacity you paid for, <em>insured against never arriving.</em>
        </h1>
        <div className={s.stage}>
          <div className={s.stageHead}>
            <span>
              Live on Monad testnet{live ? ` · contract #${live.id} · ${bytes32Label(live.terms.underlying)}` : ""}
            </span>
            {live ? <Link href={`/app/c/${live.id}`}>Watch it in the app</Link> : null}
          </div>
          {live && tape?.sla ? (
            <ProofTape id={live.id} sla={tape.sla} windowStart={tape.windowStart} windowEnd={tape.windowEnd} challenges={tape.challenges ?? []} />
          ) : (
            <div className={s.tapeGhost} aria-hidden="true" />
          )}
          <p className={s.stageNote}>
            Every cell is a proof of work the seller&apos;s machine computed for a seed taken from a fresh Monad block. Too few proofs by the
            deadline, and the buyer is paid from collateral that was locked before the sale.
          </p>
        </div>
      </section>

      <section className={`wrap ${s.split}`}>
        <div className={s.copy}>
          <h2>The provider&apos;s promise becomes a contract with a price.</h2>
          <p>
            AI teams prepay for reserved GPUs and carry the whole loss when a provider under-delivers. HYPERHEDGE lets a capital provider take
            that risk for a premium, and lets a contract, not a support ticket, decide who is owed what.
          </p>
          <ul className={s.facts}>
            <li>
              <b>The buyer</b> pays a premium per unit of protection.
            </li>
            <li>
              <b>The seller</b> locks the entire payout up front. Coverage can never exceed collateral.
            </li>
            <li>
              <b>The host</b> proves delivery with real compute, challenge by challenge.
            </li>
            <li>
              <b>Monad</b> settles it: 2-of-3 signed evidence, a challenge window, then payout or release.
            </li>
          </ul>
        </div>

        <figure className={s.receipt}>
          {settled ? (
            <>
              <figcaption>
                Contract #{settled.id.toString()} · {bytes32Label(settled.terms.underlying)}
              </figcaption>
              <dl>
                <Line k="Seller locked" v={`${usd(settled.terms.units * settled.terms.payoutPerUnit)} hhUSD`} />
                <Line k="Buyer paid" v={`${usd(settled.status.sold * settled.terms.premiumPerUnit)} hhUSD`} />
                <Line k="Host proved" v={proof ? `${proof.answered} of ${proof.issued} challenges` : "…"} />
                <Line k="Needed" v={proof?.sla ? `${proof.sla.requiredSolves}` : "…"} />
                <Line k="Oracle verdict" v="FAILURE" tone="bad" />
                <Line k="Buyer received" v={`${usd(settled.status.sold * settled.terms.payoutPerUnit)} hhUSD`} tone="strong" />
              </dl>
              <p className={s.receiptFoot}>
                {proof?.reportTx ? (
                  <a href={txLink(proof.reportTx)} target="_blank" rel="noreferrer" className="mono">
                    report {short(proof.reportTx)}
                  </a>
                ) : null}
                <Link href={`/app/c/${settled.id}`}>verify the evidence</Link>
              </p>
            </>
          ) : (
            <figcaption>Reading the latest settlement from Monad…</figcaption>
          )}
        </figure>
      </section>

      <section className={`wrap ${s.trust}`}>
        <div>
          <h3>Collateral equals the payout</h3>
          <p>A contract cannot be created unless its full maximum payout is already locked in the vault.</p>
        </div>
        <div>
          <h3>Evidence anyone can recount</h3>
          <p>Each proof takes millions of hashes to make and one to check. Your browser re-checks all of them against the chain.</p>
        </div>
        <div>
          <h3>Missing data never pays</h3>
          <p>No report by expiry releases the seller. A dispute costs a bond, lost if the report stands.</p>
        </div>
      </section>

      <footer className={s.foot}>
        <div className={`wrap ${s.footRow}`}>
          <p>Built on Monad for Metropolis 2026. Testnet only, unaudited, settled in a test token with no value.</p>
          <nav>
            <Link href="/app">App</Link>
            <a href="https://github.com/Venkat5599/Mn" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={addrLink(deployment.market)} target="_blank" rel="noreferrer">
              Contracts
            </a>
          </nav>
        </div>
        <p className={s.word} aria-hidden="true">
          HYPERHEDGE
        </p>
      </footer>
    </div>
  );
}

function Line({ k, v, tone }: { k: string; v: string; tone?: "bad" | "strong" }) {
  return (
    <div className={tone ? s[tone] : undefined}>
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}
