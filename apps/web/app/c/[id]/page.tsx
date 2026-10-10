"use client";

import {
  STATE_LABEL,
  State,
  slaHash,
  verifyEvidence,
  type Evidence,
  type EvidenceCheck,
  type Sla,
} from "@hyperhedge/sdk";
import { use, useState } from "react";
import type { Hex } from "viem";
import { Calculator, Payoff } from "@/components/Math";
import { ProofTape } from "@/components/ProofTape";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { ORACLE_API, addrLink, deployment, pub, tokenAbi, txLink } from "@/lib/chain";
import { loadContract, loadOracleContract, loadPosition, marketContract, usePoll } from "@/lib/data";
import { bytes32Label, relative, short, usd, when } from "@/lib/format";
import s from "./contract.module.css";

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = BigInt(use(params).id);
  const { account, connect } = useWallet();
  const c = usePoll(() => loadContract(id), 3_000, [id.toString()]);
  const o = usePoll(() => loadOracleContract(id), 3_000, [id.toString()]);
  const mine = usePoll(async () => (account ? loadPosition(id, account) : 0n), 4_000, [id.toString(), account]);
  const tx = useTx();
  const [units, setUnits] = useState(1);
  const now = Date.now() / 1000;

  if (!c.data) return <main className={`wrap ${s.main}`}>{c.error ? <p>{c.error}</p> : <p className="muted">Reading contract #{id.toString()} from Monad…</p>}</main>;
  const { terms: t, status: st, bond } = c.data;
  const state = st.state as State;
  const label = STATE_LABEL[state];
  const sla = o.data?.sla ?? null;
  const slaOk = sla ? slaHash(sla) === t.slaHash : null;
  const available = t.units - st.sold;
  const premium = BigInt(units) * t.premiumPerUnit;
  const saleOpen = (state === State.OPEN || state === State.ACTIVE) && now < Number(t.saleEnd) && available > 0n;
  const held = mine.data ?? 0n;
  const isSeller = account?.toLowerCase() === t.seller.toLowerCase();

  const buy = () =>
    tx.run([
      { label: "Approve hhUSD for the vault", request: { address: deployment.token, abi: tokenAbi, functionName: "approve", args: [deployment.vault, premium] } },
      { label: `Buy ${units} unit${units > 1 ? "s" : ""}`, request: { ...marketContract, functionName: "buy", args: [id, BigInt(units), premium] } },
    ]);
  const act = (label: string, functionName: string) => tx.run([{ label, request: { ...marketContract, functionName, args: [id] } }]);

  return (
    <main className={`wrap ${s.main}`}>
      <header className={s.head}>
        <p className="muted mono">Contract #{id.toString()}</p>
        <h1>{bytes32Label(t.underlying)} delivery protection</h1>
        <p className={s.state}>
          <span className={`st st-${label.toLowerCase().replace(" ", "")}`}>{label}</span>
          <span className="muted">{phaseLine(state, t, st, now)}</span>
        </p>
      </header>

      <div className={s.grid}>
        <section className={`panel ${s.tape}`}>
          <h2>Delivery, as proven by the host</h2>
          {sla && o.data ? (
            <ProofTape id={id} sla={sla} windowStart={o.data.windowStart} windowEnd={o.data.windowEnd} challenges={o.data.challenges ?? []} />
          ) : (
            <p className="muted">{o.error ? "The oracle is unreachable right now; onchain state below is unaffected." : "Loading the oracle's challenge log…"}</p>
          )}
          {o.data?.abstained ? <p className={s.warn}>The oracle abstained: {o.data.abstained}. Missing data never pays out; this contract will expire.</p> : null}
          {o.data?.evidenceHash && sla ? <Verify hash={o.data.evidenceHash} onchain={st.evidenceHash as Hex} sla={sla} /> : null}
        </section>

        <aside className={`panel ${s.ticket}`}>
          <h2>Buy protection</h2>
          <dl className={s.kv}>
            <Row k="Premium per unit" v={`${usd(t.premiumPerUnit)} hhUSD`} />
            <Row k="Payout per unit on failure" v={`${usd(t.payoutPerUnit)} hhUSD`} />
            <Row k="Protocol fee" v={t.feeBps ? `${t.feeBps / 100}% of premium` : "none"} />
            <Row k="Available" v={`${available} of ${t.units} units`} />
          </dl>
          {saleOpen ? (
            <>
              <label>
                Units
                <input type="number" min={1} max={Number(available)} value={units} onChange={(e) => setUnits(Math.min(Number(available), Math.max(1, Math.floor(+e.target.value) || 1)))} />
              </label>
              <p className={s.total}>
                You pay <b className="num">{usd(premium)}</b> hhUSD. If delivery fails you receive <b className="num">{usd(BigInt(units) * t.payoutPerUnit)}</b>.
              </p>
              {account ? (
                <button className="btn" onClick={buy} disabled={tx.state.phase === "signing" || tx.state.phase === "pending"}>
                  Approve and buy
                </button>
              ) : (
                <button className="btn" onClick={connect}>
                  Connect wallet to buy
                </button>
              )}
            </>
          ) : (
            <p className="muted">Sales {now >= Number(t.saleEnd) ? "closed " + relative(t.saleEnd, now) : "are closed"}.</p>
          )}
          <Actions state={state} t={t} st={st} held={held} isSeller={isSeller} bond={bond} now={now} act={act} account={account} />
          <TxStatus state={tx.state} />
          <p className={s.risk}>
            Risks: one oracle operator runs all three signers; a guardian resolves disputes; contracts are unaudited; hhUSD has no value.
          </p>
        </aside>
      </div>

      <section className={`panel ${s.terms}`}>
        <h2>Terms, as committed onchain</h2>
        <dl className={s.kv2}>
          <Row k="Seller" v={<a href={addrLink(t.seller)} target="_blank" rel="noreferrer" className="mono">{short(t.seller)}</a>} />
          <Row k="Collateral locked" v={`${usd(t.units * t.payoutPerUnit)} hhUSD, equal to the maximum payout`} />
          <Row k="Covered quantity" v={`${t.quantity.toString()} ${bytes32Label(t.underlying)}`} />
          <Row k="Sales close" v={when(t.saleEnd)} />
          <Row k="Delivery deadline" v={when(t.deliveryDeadline)} />
          <Row k="Reports accepted until" v={when(t.expiry)} />
          <Row k="Evidence policy" v={`#${t.policyId}: 2 of 3 signers, 5 min challenge window, dispute bond ${usd(bond)} hhUSD`} />
          <Row k="Delivery host" v={sla ? <span className="mono">{sla.host}</span> : "…"} />
          <Row k="Proof required" v={sla ? `${sla.requiredSolves} proofs of 2^${sla.difficultyBits} hashes, one every ${sla.intervalSec}s, each within ${sla.answerWithinSec}s` : "…"} />
          <Row k="Compute class" v={sla?.computeClass ?? "…"} />
          <Row k="SLA commitment" v={slaOk === null ? "…" : slaOk ? <span className={s.good}>matches slaHash {short(t.slaHash)}</span> : <span className={s.bad}>does not match the onchain hash</span>} />
        </dl>
      </section>

      <section className={s.mathRow}>
        <div className="panel">
          <h2>Payoff per unit</h2>
          <Payoff premium={t.premiumPerUnit} payout={t.payoutPerUnit} />
        </div>
        <div className="panel">
          <h2>Expected value</h2>
          <Calculator premium={t.premiumPerUnit} payout={t.payoutPerUnit} />
        </div>
      </section>

      <Lifecycle t={t} st={st} reportTx={o.data?.reportTx} now={now} />
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

type T = Awaited<ReturnType<typeof loadContract>>["terms"];
type St = Awaited<ReturnType<typeof loadContract>>["status"];

function phaseLine(state: State, t: T, st: St, now: number) {
  switch (state) {
    case State.OPEN:
    case State.ACTIVE:
      if (now < Number(t.saleEnd)) return `sales close ${relative(t.saleEnd, now)}`;
      if (now < Number(t.deliveryDeadline)) return `delivery window closes ${relative(t.deliveryDeadline, now)}`;
      return `waiting for the oracle's report, accepted until ${relative(t.expiry, now)}`;
    case State.REVIEW:
      return `${st.outcome === 1 ? "failure" : "delivery"} reported · challenge window closes ${relative(st.challengeEnd, now)}`;
    case State.DISPUTED:
      return `guardian must resolve ${relative(st.resolveBy, now)}`;
    case State.DELIVERED:
      return `delivery final · seller released at expiry, ${relative(t.expiry, now)}`;
    case State.SETTLED:
      return "failure final · holders can claim";
    case State.EXPIRED:
      return "seller released";
    case State.VOIDED:
      return "voided · premiums refundable";
    default:
      return "";
  }
}

function Actions(p: { state: State; t: T; st: St; held: bigint; isSeller: boolean; bond: bigint; now: number; act: (l: string, f: string) => void; account?: string }) {
  const { state, t, st, held, isSeller, now, act } = p;
  const items: { label: string; fn: string; note: string }[] = [];
  if (state === State.SETTLED && held > 0n) items.push({ label: `Claim ${usd(held * (t.payoutPerUnit + st.bondPerUnit))} hhUSD`, fn: "claim", note: "your verified payout" });
  if (state === State.VOIDED && held > 0n) items.push({ label: "Refund premium", fn: "refund", note: "the contract was voided" });
  if (state === State.REVIEW && now < Number(st.challengeEnd)) {
    if (st.outcome === 1 && isSeller) items.push({ label: `Dispute (bond ${usd(p.bond)})`, fn: "dispute", note: "lost to buyers if the report stands" });
    if (st.outcome === 2 && held > 0n && !isSeller) items.push({ label: `Dispute (bond ${usd(p.bond)})`, fn: "dispute", note: "lost to the seller if the report stands" });
  }
  // permissionless transitions: anyone can move funds along once the rules allow it
  if (state === State.REVIEW && now >= Number(st.challengeEnd)) items.push({ label: "Finalize", fn: "finalize", note: "challenge window is over" });
  if (state === State.DISPUTED && now > Number(st.resolveBy)) items.push({ label: "Finalize (guardian timed out)", fn: "finalize", note: "voids, bond still slashed" });
  if ((state === State.ACTIVE && now > Number(t.expiry)) || (state === State.DELIVERED && now >= Number(t.expiry))) items.push({ label: "Expire", fn: "expire", note: "release the seller" });
  if (!items.length || !p.account) return null;
  return (
    <div className={s.actions}>
      {items.map((i) => (
        <button key={i.fn} className="btn quiet" onClick={() => act(i.label, i.fn)} title={i.note}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

function Verify({ hash, onchain, sla }: { hash: Hex; onchain: Hex; sla: Sla }) {
  const [result, setResult] = useState<EvidenceCheck & { hashOk: boolean }>();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const raw = await (await fetch(`${ORACLE_API}/evidence/${hash}`)).text();
      const e = JSON.parse(raw) as Evidence;
      const { keccak256, toHex } = await import("viem");
      const hashOk = keccak256(toHex(raw)) === onchain;
      const blockHashOf = async (n: number) => (await pub.getBlock({ blockNumber: BigInt(n) })).hash;
      const check = await verifyEvidence(e, sla, blockHashOf);
      setResult({ ...check, hashOk });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.verify}>
      <p>
        Evidence <a className="mono" href={`${ORACLE_API}/evidence/${hash}`} target="_blank" rel="noreferrer">{short(hash, 6)}</a>
        {onchain && onchain !== hash ? <span className={s.bad}> differs from the onchain hash</span> : null}
      </p>
      <button className="btn quiet" onClick={run} disabled={busy}>
        {busy ? "Re-checking every proof and block…" : "Verify the evidence yourself"}
      </button>
      {result ? (
        <ul className={s.checks}>
          <li className={result.hashOk ? s.good : s.bad}>{result.hashOk ? "File hash equals the evidenceHash stored onchain" : "File hash does not match the onchain evidenceHash"}</li>
          <li className={result.ok ? s.good : s.bad}>
            {result.ok ? `All proofs, seeds and block hashes check out: ${result.solved} valid, verdict ${result.verdict}` : result.problems.join("; ")}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function Lifecycle({ t, st, reportTx, now }: { t: T; st: St; reportTx?: Hex; now: number }) {
  const state = st.state as State;
  const reached = (ts: bigint) => now >= Number(ts);
  const steps: { label: string; at?: string; done: boolean; tone?: string; link?: string }[] = [
    { label: "Terms committed and collateral locked", done: true },
    { label: `Protection sold: ${st.sold} of ${t.units} units`, done: st.sold > 0n },
    { label: "Sales closed, delivery window opens", at: when(t.saleEnd), done: reached(t.saleEnd) },
    { label: "Delivery deadline", at: when(t.deliveryDeadline), done: reached(t.deliveryDeadline) },
    {
      label: st.outcome === 0 ? "Oracle report verified onchain (2 of 3 signatures)" : `Report verified: ${st.outcome === 1 ? "FAILURE" : "DELIVERED"}`,
      done: st.outcome !== 0,
      tone: st.outcome === 1 ? "bad" : st.outcome === 2 ? "good" : undefined,
      link: reportTx,
    },
    { label: "Challenge window", at: st.challengeEnd ? when(st.challengeEnd) : undefined, done: state > State.DISPUTED || (state === State.REVIEW && reached(st.challengeEnd)) },
    {
      label: state === State.SETTLED ? "Payout claimable by holders" : state === State.VOIDED ? "Voided, premiums refundable" : "Collateral and premium released to the seller",
      done: state === State.SETTLED || state === State.EXPIRED || state === State.VOIDED,
      tone: state === State.SETTLED ? "bad" : state === State.EXPIRED ? "good" : undefined,
    },
  ];
  return (
    <section className={`panel ${s.life}`}>
      <h2>Lifecycle</h2>
      <ol>
        {steps.map((x) => (
          <li key={x.label} className={`${x.done ? s.done : ""} ${x.tone === "bad" ? s.toneBad : x.tone === "good" ? s.toneGood : ""}`}>
            <span>{x.label}</span>
            {x.at ? <span className="num muted">{x.at}</span> : null}
            {x.link ? (
              <a href={txLink(x.link)} target="_blank" rel="noreferrer" className="mono">
                tx {short(x.link)}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
