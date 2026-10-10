"use client";

import { maxChallenges, slaHash, slaToUri, validateSla, type Sla } from "@hyperhedge/sdk";
import { useMemo, useState } from "react";
import { stringToHex } from "viem";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { deployment, pub, tokenAbi } from "@/lib/chain";
import { marketContract, usePoll, vaultContract } from "@/lib/data";
import { usd } from "@/lib/format";
import s from "../form.module.css";

const USD = 1_000_000n;
const DEMO_HOST = "http://187.127.137.136:9795";

export default function Issue() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const [f, setF] = useState({
    underlying: "H100-80GB-GPUh",
    quantity: 1000,
    units: 5,
    payout: 100,
    premium: 8,
    saleMin: 5,
    deliveryMin: 5,
    reportMin: 15,
    host: DEMO_HOST,
    computeClass: "GPU compute delivery",
    difficultyBits: 20,
    intervalSec: 15,
    answerWithinSec: 10,
    requiredPct: 80,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === "number" ? +e.target.value : e.target.value });

  const free = usePoll(async () => (account ? pub.readContract({ ...vaultContract, functionName: "free", args: [account] }) : 0n), 5_000, [account]);
  const slots = Math.max(0, Math.floor((f.deliveryMin * 60 - f.answerWithinSec) / f.intervalSec) + 1);
  const required = Math.max(1, Math.round((slots * f.requiredPct) / 100));
  const sla: Sla = useMemo(
    () => ({
      v: 1,
      kind: "pow-delivery",
      computeClass: f.computeClass,
      host: f.host,
      difficultyBits: f.difficultyBits,
      requiredSolves: required,
      intervalSec: f.intervalSec,
      answerWithinSec: f.answerWithinSec,
    }),
    [f, required],
  );
  let slaError: string | undefined;
  try {
    validateSla(sla);
    if (required > maxChallenges(sla, 0, f.deliveryMin * 60)) slaError = "more proofs required than fit in the window";
  } catch (e) {
    slaError = (e as Error).message;
  }
  const M = BigInt(f.units) * BigInt(Math.round(f.payout)) * USD;
  const need = M > (free.data ?? 0n) ? M - (free.data ?? 0n) : 0n;

  const submit = async () => {
    const block = await pub.getBlock();
    const now = Number(block.timestamp);
    const saleEnd = now + f.saleMin * 60;
    const deadline = saleEnd + f.deliveryMin * 60;
    const terms = {
      seller: account!,
      underlying: stringToHex(f.underlying.slice(0, 31), { size: 32 }),
      quantity: BigInt(f.quantity),
      slaHash: slaHash(sla),
      units: BigInt(f.units),
      payoutPerUnit: BigInt(Math.round(f.payout)) * USD,
      premiumPerUnit: BigInt(Math.round(f.premium * 100)) * 10_000n,
      feeBps: 0,
      saleEnd: BigInt(saleEnd),
      deliveryDeadline: BigInt(deadline),
      expiry: BigInt(deadline + f.reportMin * 60),
      policyId: deployment.policyId,
    };
    const steps = [];
    if (need > 0n) {
      steps.push({ label: "Approve collateral", request: { address: deployment.token, abi: tokenAbi, functionName: "approve", args: [deployment.vault, need] } });
      steps.push({ label: `Deposit ${usd(need)} hhUSD`, request: { ...vaultContract, functionName: "deposit", args: [need] } });
    }
    steps.push({ label: "Create contract", request: { ...marketContract, functionName: "create", args: [terms, slaToUri(sla)] } });
    await tx.run(steps);
  };

  return (
    <main className={`wrap ${s.main}`}>
      <header className={s.head}>
        <h1>Issue delivery protection</h1>
        <p className="muted">
          You become the seller. The full maximum payout is locked from your vault balance until the contract settles. You earn the premium
          if the host proves delivery.
        </p>
      </header>

      <div className={s.cols}>
        <section className={`panel ${s.block}`}>
          <h2>The obligation</h2>
          <div className={s.fields}>
            <label>
              Underlying
              <input value={f.underlying} onChange={set("underlying")} maxLength={31} />
            </label>
            <label>
              Quantity covered
              <input type="number" min={1} value={f.quantity} onChange={set("quantity")} />
            </label>
            <label>
              Units for sale
              <input type="number" min={1} value={f.units} onChange={set("units")} />
            </label>
            <label>
              Payout per unit (hhUSD)
              <input type="number" min={1} value={f.payout} onChange={set("payout")} />
            </label>
            <label>
              Premium per unit (hhUSD)
              <input type="number" min={0.01} step={0.01} value={f.premium} onChange={set("premium")} />
            </label>
            <label>
              Sales open for (min)
              <input type="number" min={1} value={f.saleMin} onChange={set("saleMin")} />
            </label>
            <label>
              Delivery window (min)
              <input type="number" min={1} value={f.deliveryMin} onChange={set("deliveryMin")} />
            </label>
            <label>
              Report period after deadline (min)
              <input type="number" min={5} value={f.reportMin} onChange={set("reportMin")} />
            </label>
          </div>
        </section>

        <section className={`panel ${s.block}`}>
          <h2>How delivery is proven</h2>
          <div className={s.fields}>
            <label className={s.full}>
              Host agent URL
              <input value={f.host} onChange={set("host")} />
            </label>
            <label className={s.full}>
              Compute class label
              <input value={f.computeClass} onChange={set("computeClass")} />
            </label>
            <label>
              Difficulty (bits)
              <input type="number" min={8} max={28} value={f.difficultyBits} onChange={set("difficultyBits")} />
            </label>
            <label>
              Challenge every (s)
              <input type="number" min={5} value={f.intervalSec} onChange={set("intervalSec")} />
            </label>
            <label>
              Answer within (s)
              <input type="number" min={1} value={f.answerWithinSec} onChange={set("answerWithinSec")} />
            </label>
            <label>
              Proofs required (%)
              <input type="number" min={1} max={100} value={f.requiredPct} onChange={set("requiredPct")} />
            </label>
          </div>
          <p className={s.note}>
            <span className="num">{slots}</span> challenges fit the window; delivery needs <span className="num">{required}</span> valid proofs of{" "}
            <span className="num">2^{f.difficultyBits}</span> hashes. The demo host is a 2-core VPS running the agent in <span className="mono">apps/agent</span>.
          </p>
        </section>
      </div>

      <section className={`panel ${s.summary}`}>
        <p>
          Locks <b className="num">{usd(M)}</b> hhUSD as collateral. Your free vault balance is <b className="num">{usd(free.data ?? 0n)}</b>
          {need > 0n ? (
            <>
              ; <b className="num">{usd(need)}</b> more will be deposited from your wallet.
            </>
          ) : (
            "."
          )}
        </p>
        {slaError ? <p className={s.err}>{slaError}</p> : null}
        {account ? (
          <button className="btn" onClick={submit} disabled={Boolean(slaError) || tx.state.phase === "signing" || tx.state.phase === "pending"}>
            {need > 0n ? "Approve, deposit and create" : "Create contract"}
          </button>
        ) : (
          <button className="btn" onClick={connect}>
            Connect wallet
          </button>
        )}
        <TxStatus state={tx.state} />
      </section>
    </main>
  );
}
