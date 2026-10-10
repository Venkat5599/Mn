"use client";

import { STATE_LABEL, State } from "@hyperhedge/sdk";
import Link from "next/link";
import { Calculator, CoverageBars, Payoff } from "@/components/Math";
import { ProofTape } from "@/components/ProofTape";
import { addrLink, deployment } from "@/lib/chain";
import { loadContracts, loadOracle, loadOracleContract, loadVault, usePoll } from "@/lib/data";
import { bytes32Label, relative, short, usd } from "@/lib/format";
import s from "./page.module.css";

export default function Markets() {
  const contracts = usePoll(loadContracts, 4_000, []);
  const vault = usePoll(loadVault, 6_000, []);
  const oracle = usePoll(loadOracle, 4_000, []);
  const rows = contracts.data ?? [];
  const featured = rows.find((r) => r.status.state === State.ACTIVE) ?? rows[0];
  const live = usePoll(
    async () => (featured ? loadOracleContract(featured.id) : undefined),
    3_000,
    [featured?.id.toString()],
  );
  const now = Date.now() / 1000;

  return (
    <main className={s.main}>
      <section className={`wrap ${s.lead}`}>
        <h1 className={s.title}>
          The risk that GPU compute is not delivered, <em>priced and settled onchain.</em>
        </h1>
        <p className={s.sub}>
          A buyer pays a premium; a seller locks the full payout as collateral; the host proves delivery with real compute, challenge by
          challenge. If it cannot, the buyer is paid on Monad.
        </p>
      </section>

      <section className={`wrap ${s.stage}`}>
        <div className={`panel ${s.tapePanel}`}>
          {featured && live.data?.sla ? (
            <>
              <header className={s.tapeHead}>
                <Link href={`/c/${featured.id}`} className={s.tapeTitle}>
                  Contract #{featured.id.toString()} · {bytes32Label(featured.terms.underlying)}
                </Link>
                <span className={`st st-${STATE_LABEL[featured.status.state as State].toLowerCase().replace(" ", "")}`}>
                  {STATE_LABEL[featured.status.state as State]}
                </span>
                <span className="muted">
                  window {now < Number(featured.terms.saleEnd) ? "opens" : now < Number(featured.terms.deliveryDeadline) ? "closes" : "closed"}{" "}
                  {relative(now < Number(featured.terms.saleEnd) ? featured.terms.saleEnd : featured.terms.deliveryDeadline, now)}
                </span>
              </header>
              <ProofTape
                id={featured.id}
                sla={live.data.sla}
                windowStart={live.data.windowStart}
                windowEnd={live.data.windowEnd}
                challenges={live.data.challenges ?? []}
              />
              <p className={s.tapeNote}>
                Each cell is a proof of work the seller&apos;s host computed for a seed taken from a fresh Monad block. Your browser re-checks
                every one.
              </p>
            </>
          ) : (
            <p className="muted">{contracts.error ?? oracle.error ?? "Loading the live market from Monad testnet…"}</p>
          )}
        </div>

        <dl className={s.vault}>
          <Stat label="Collateral locked" value={vault.data ? usd(vault.data.reserved) : "…"} />
          <Stat label="Premiums held" value={vault.data ? usd(vault.data.premium) : "…"} />
          <Stat label="Payouts claimable" value={vault.data ? usd(vault.data.payable) : "…"} />
          <Stat label="Dispute bonds" value={vault.data ? usd(vault.data.bond) : "…"} />
          <div className={s.reconcile}>
            <dt>Vault reconciles</dt>
            <dd className={vault.data?.reconciled ? s.ok : s.bad}>
              {vault.data ? (vault.data.reconciled ? "every token accounted for" : "mismatch") : "…"}
            </dd>
          </div>
          <p className={s.unit}>
            hhUSD, a testnet token with no value ·{" "}
            <a href={addrLink(deployment.vault)} target="_blank" rel="noreferrer">
              vault {short(deployment.vault)}
            </a>
          </p>
        </dl>
      </section>

      <section className="wrap">
        <div className={s.rowHead}>
          <h2>Contracts</h2>
          <Link href="/issue" className="btn quiet">
            Issue protection
          </Link>
        </div>
        <div className="panel scroll-x">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Underlying</th>
                <th>State</th>
                <th>Premium / unit</th>
                <th>Payout / unit</th>
                <th>Sold</th>
                <th>Delivery deadline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = STATE_LABEL[r.status.state as State];
                return (
                  <tr key={r.id.toString()}>
                    <td className="num">
                      <Link href={`/c/${r.id}`}>{r.id.toString()}</Link>
                    </td>
                    <td>
                      <Link href={`/c/${r.id}`}>{bytes32Label(r.terms.underlying)}</Link>
                    </td>
                    <td className={`st st-${label.toLowerCase().replace(" ", "")}`}>{label}</td>
                    <td className="num">{usd(r.terms.premiumPerUnit)}</td>
                    <td className="num">{usd(r.terms.payoutPerUnit)}</td>
                    <td className="num">
                      {r.status.sold.toString()} / {r.terms.units.toString()}
                    </td>
                    <td className="num">{relative(r.terms.deliveryDeadline, now)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && !contracts.error ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No contracts yet. Issue the first one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`wrap ${s.math}`}>
        <div className="panel">
          <h3>What the buyer can win or lose</h3>
          {featured ? <Payoff premium={featured.terms.premiumPerUnit} payout={featured.terms.payoutPerUnit} /> : null}
        </div>
        <div className="panel">
          <h3>Is the premium worth it?</h3>
          <Calculator key={featured?.id.toString() ?? "none"} premium={featured?.terms.premiumPerUnit} payout={featured?.terms.payoutPerUnit} />
        </div>
        <div className={`panel ${s.wide}`}>
          <h3>Collateral against what could be owed</h3>
          <CoverageBars
            rows={rows.map((r) => ({
              id: r.id,
              reserved:
                r.status.state === State.SETTLED || r.status.state === State.EXPIRED || r.status.state === State.VOIDED
                  ? 0n
                  : (r.status.unsoldReleased ? r.status.sold : r.terms.units) * r.terms.payoutPerUnit,
              liability:
                r.status.state === State.SETTLED || r.status.state === State.EXPIRED || r.status.state === State.VOIDED
                  ? 0n
                  : r.status.sold * r.terms.payoutPerUnit,
              state: STATE_LABEL[r.status.state as State],
            }))}
          />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
