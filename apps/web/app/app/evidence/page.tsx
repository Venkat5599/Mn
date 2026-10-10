"use client";

import { verifyEvidence, type Evidence, type EvidenceCheck } from "@hyperhedge/sdk";
import Link from "next/link";
import { useState } from "react";
import { keccak256, toHex } from "viem";
import { ORACLE_API, pub, txLink } from "@/lib/chain";
import { loadContracts, loadOracle, usePoll, type OracleView } from "@/lib/data";
import { short } from "@/lib/format";
import s from "../pages.module.css";

export default function EvidenceCenter() {
  const oracle = usePoll(loadOracle, 12_000, []);
  const rows = usePoll(loadContracts, 12_000, []);
  const [results, setResults] = useState<Record<string, (EvidenceCheck & { hashOk: boolean }) | "busy">>({});
  const withEvidence = (oracle.data ?? []).filter((o) => o.evidenceHash);

  const verify = async (o: OracleView) => {
    setResults((r) => ({ ...r, [o.id]: "busy" }));
    const raw = await (await fetch(`${ORACLE_API}/evidence/${o.evidenceHash}`)).text();
    const e = JSON.parse(raw) as Evidence;
    const onchain = rows.data?.find((r) => r.id.toString() === o.id)?.status.evidenceHash;
    const check = await verifyEvidence(e, o.sla!, async (n) => (await pub.getBlock({ blockNumber: BigInt(n) })).hash);
    setResults((r) => ({ ...r, [o.id]: { ...check, hashOk: keccak256(toHex(raw)) === onchain } }));
  };

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Evidence Center</h1>
        <p>
          Each report the oracle signed points to an evidence file: every challenge, the Monad block that seeded it, and the host&apos;s
          proof of work. Re-check any of them here. Your browser recomputes every proof and compares every block with the chain.
        </p>
      </header>
      <section className={`panel ${s.card}`}>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Host</th>
                <th>Proofs</th>
                <th>Evidence file</th>
                <th>Report</th>
                <th>Independent check</th>
              </tr>
            </thead>
            <tbody>
              {withEvidence.map((o) => {
                const r = results[o.id];
                return (
                  <tr key={o.id}>
                    <td className="num">
                      <Link href={`/app/c/${o.id}`}>#{o.id}</Link>
                    </td>
                    <td className="mono">{o.sla?.host.replace(/^https?:\/\//, "")}</td>
                    <td className="num">
                      {o.answered} of {o.issued} · needs {o.sla?.requiredSolves}
                    </td>
                    <td>
                      <a href={`${ORACLE_API}/evidence/${o.evidenceHash}`} target="_blank" rel="noreferrer" className="mono">
                        {short(o.evidenceHash!, 6)}
                      </a>
                    </td>
                    <td>
                      {o.reportTx ? (
                        <a href={txLink(o.reportTx)} target="_blank" rel="noreferrer" className="mono">
                          {short(o.reportTx)}
                        </a>
                      ) : null}
                    </td>
                    <td>
                      {r === undefined ? (
                        <button className="btn quiet" onClick={() => void verify(o)}>
                          Verify
                        </button>
                      ) : r === "busy" ? (
                        <span className={s.mute}>checking every proof…</span>
                      ) : r.ok && r.hashOk ? (
                        <span className={s.ok}>
                          valid · {r.solved} proofs · {r.verdict}
                        </span>
                      ) : (
                        <span className={s.bad}>{r.hashOk ? r.problems.join("; ") : "file does not match the onchain hash"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!withEvidence.length ? <p className={s.mute}>{oracle.error ?? "No reports yet."}</p> : null}
      </section>
    </main>
  );
}
