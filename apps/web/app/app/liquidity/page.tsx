"use client";

import { addrLink, deployment } from "@/lib/chain";
import { loadVault, usePoll } from "@/lib/data";
import { short, usd } from "@/lib/format";
import { POOL, loadPoolState } from "@/lib/pool";
import s from "../pages.module.css";

function Bucket({ label, value, total, note }: { label: string; value: bigint; total: bigint; note: string }) {
  const pct = total > 0n ? Number((value * 10_000n) / total) / 100 : 0;
  return (
    <li style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span>
          <b>{label}</b> <span className={s.mute}>· {note}</span>
        </span>
        <span className="num">
          {usd(value)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className={s.bar}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export default function Liquidity() {
  const v = usePoll(loadVault, 10_000, []);
  const p = usePoll(loadPoolState, 12_000, []);
  const vault = v.data;
  const pool = p.data;
  const shareValue = pool && pool.totalShares > 0n ? Number(pool.assets) / Number(pool.totalShares) : 1;

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Liquidity &amp; Collateral</h1>
        <p>Where every token sits, read live from the contracts. Nothing here is an estimate.</p>
      </header>

      <div className={s.two}>
        <section className={`panel ${s.card}`}>
          <h2>
            Delivery vault ·{" "}
            <a href={addrLink(deployment.vault)} target="_blank" rel="noreferrer" className="mono">
              {short(deployment.vault)}
            </a>
          </h2>
          {vault ? (
            <>
              <p>
                Holds <b className="num">{usd(vault.balance)}</b> hhUSD.{" "}
                {vault.reconciled ? (
                  <span className={s.ok}>reconcile(): every token is in exactly one bucket</span>
                ) : (
                  <span className={s.bad}>reconcile() reports a mismatch</span>
                )}
              </p>
              <ul className={s.list}>
                <Bucket label="Free" value={vault.free} total={vault.balance} note="sellers can withdraw" />
                <Bucket label="Reserved" value={vault.reserved} total={vault.balance} note="locked behind live contracts" />
                <Bucket label="Premiums" value={vault.premium} total={vault.balance} note="held until the outcome is final" />
                <Bucket label="Payable" value={vault.payable} total={vault.balance} note="owed to buyers, claimable" />
                <Bucket label="Dispute bonds" value={vault.bond} total={vault.balance} note="at stake in open disputes" />
                <Bucket label="Fees" value={vault.fees} total={vault.balance} note="protocol" />
              </ul>
            </>
          ) : (
            <p className={s.mute}>{v.error ?? "Reading the vault…"}</p>
          )}
        </section>

        <section className={`panel ${s.card}`}>
          <h2>
            Price protection pool ·{" "}
            <a href={addrLink(POOL)} target="_blank" rel="noreferrer" className="mono">
              {short(POOL)}
            </a>
          </h2>
          {pool ? (
            <>
              <p>
                Holds <b className="num">{usd(pool.assets)}</b> hhUSD from liquidity providers and earned premiums.
              </p>
              <ul className={s.list}>
                <Bucket label="Locked" value={pool.locked} total={pool.assets} note="maximum payout of open policies" />
                <Bucket label="Free" value={pool.assets - pool.locked} total={pool.assets} note="can back new policies or be withdrawn" />
              </ul>
              <ul className={s.list}>
                <li>
                  <span>Coverage of locked payouts</span>
                  <b className="num">{pool.locked > 0n ? `${(Number(pool.assets) / Number(pool.locked)).toFixed(1)}×` : "no open policies"}</b>
                </li>
                <li>
                  <span>Value of one LP share</span>
                  <b className="num">{shareValue.toFixed(6)} hhUSD</b>
                </li>
                <li>
                  <span>Open / total policies</span>
                  <b className="num">
                    {pool.positions.filter((x) => !x.settled).length} / {pool.positions.length}
                  </b>
                </li>
              </ul>
            </>
          ) : (
            <p className={s.mute}>{p.error ?? "Reading the pool…"}</p>
          )}
        </section>
      </div>
    </main>
  );
}
