import {
  State,
  buildEvidence,
  canonicalJson,
  computeMarketAbi,
  deriveSeed,
  evidenceHash,
  maxChallenges,
  outcomeOf,
  reportDomain,
  reportTypes,
  slaFromUri,
  slaHash,
  type ChallengeRecord,
  type IncidentReport,
} from "@hyperhedge/sdk";
import { encodeAbiParameters, getAbiItem, keccak256, type Hex } from "viem";
import { log, type Env } from "./env";
import type { Store, Tracked } from "./store";

const CREATED = getAbiItem({ abi: computeMarketAbi, name: "Created" });
const LOG_CHUNK = 100n; // Monad testnet RPC caps eth_getLogs at a 100-block range

type Terms = Awaited<ReturnType<typeof readTerms>>;
type Status = Awaited<ReturnType<typeof readStatus>>;

function readTerms(env: Env, id: bigint) {
  return env.pub.readContract({ address: env.deployment.market, abi: computeMarketAbi, functionName: "terms", args: [id] });
}
function readStatus(env: Env, id: bigint) {
  return env.pub.readContract({ address: env.deployment.market, abi: computeMarketAbi, functionName: "status", args: [id] });
}

export class Oracle {
  /** Contracts with a probe in flight, so a slow host never gets two challenges at once. */
  private probing = new Set<string>();
  // Hosts with a challenge in flight: the agent proves one challenge at a time, and two contracts on the
  // same host must not make an honest host look like it missed one.
  private busyHosts = new Set<string>();

  constructor(
    private readonly env: Env,
    private readonly store: Store,
  ) {}

  async tick() {
    await this.discover();
    const head = await this.env.pub.getBlock({ blockTag: "latest" });
    const chainNow = Number(head.timestamp);
    for (const c of this.store.contracts.values()) {
      try {
        const id = BigInt(c.id);
        const [terms, status] = await Promise.all([readTerms(this.env, id), readStatus(this.env, id)]);
        this.maybeProbe(c, status, head.number, head.hash);
        await this.maybeReport(c, terms, status, chainNow);
        await this.keep(c, terms, status, chainNow);
      } catch (err) {
        log("contract tick failed", { id: c.id, err: String(err) });
      }
    }
  }

  // ───────────── discovery: every Created event, with its committed SLA ─────────────

  private async discover() {
    const latest = await this.env.logsPub.getBlockNumber();
    let from = BigInt(this.store.scannedTo + 1);
    while (from <= latest) {
      const to = from + LOG_CHUNK - 1n < latest ? from + LOG_CHUNK - 1n : latest;
      const logs = await this.env.logsPub.getLogs({ address: this.env.deployment.market, event: CREATED, fromBlock: from, toBlock: to });
      for (const l of logs) {
        const { id, terms, slaURI } = l.args;
        if (id === undefined || !terms || slaURI === undefined) continue;
        this.store.contracts.set(id.toString(), this.track(id, terms, slaURI));
        log("contract discovered", { id, underlying: terms.underlying });
      }
      this.store.scannedTo = Number(to);
      from = to + 1n;
    }
    await this.store.save();
  }

  private track(id: bigint, terms: { saleEnd: bigint; deliveryDeadline: bigint; slaHash: Hex }, slaURI: string): Tracked {
    const base = {
      id: id.toString(),
      windowStart: Number(terms.saleEnd),
      windowEnd: Number(terms.deliveryDeadline),
      challenges: [],
    };
    try {
      const sla = slaFromUri(slaURI);
      // The buyer read `slaURI`; the contract committed `slaHash`. If they differ, nobody can know the terms.
      if (slaHash(sla) !== terms.slaHash) return { ...base, sla: null, slaError: "slaURI does not match slaHash" };
      return { ...base, sla };
    } catch (err) {
      return { ...base, sla: null, slaError: String(err) };
    }
  }

  // ───────────── probing: block-seeded proof-of-work challenges during the window ─────────────

  private maybeProbe(c: Tracked, status: Status, blockNumber: bigint, blockHash: Hex) {
    const sla = c.sla;
    if (!sla || status.state !== State.ACTIVE || this.probing.has(c.id) || this.busyHosts.has(sla.host)) return;
    const now = Date.now();
    const index = c.challenges.length;
    const scheduled = (c.windowStart + index * sla.intervalSec) * 1000;
    const dueBy = now + sla.answerWithinSec * 1000;
    if (now < scheduled || dueBy > c.windowEnd * 1000) return;

    const seed = deriveSeed(BigInt(c.id), index, blockHash);
    const record: ChallengeRecord = {
      index,
      blockNumber: Number(blockNumber),
      blockHash,
      seed,
      issuedAt: now,
      dueBy,
      nonce: null,
      answeredAt: null,
    };
    c.challenges.push(record);
    this.probing.add(c.id);
    this.busyHosts.add(sla.host);
    void this.ask(c, record, sla.host, sla.difficultyBits, sla.answerWithinSec).finally(() => {
      this.probing.delete(c.id);
      this.busyHosts.delete(sla.host);
      void this.store.save();
    });
  }

  private async ask(c: Tracked, r: ChallengeRecord, host: string, bits: number, withinSec: number) {
    try {
      const res = await fetch(`${host.replace(/\/$/, "")}/solve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seed: r.seed, difficultyBits: bits }),
        signal: AbortSignal.timeout(withinSec * 1000),
      });
      const answeredAt = Date.now();
      if (!res.ok) throw new Error(`host HTTP ${res.status}`);
      const body = (await res.json()) as { nonce?: string };
      if (typeof body.nonce !== "string" || !/^\d+$/.test(body.nonce)) throw new Error("no nonce");
      r.nonce = body.nonce;
      r.answeredAt = answeredAt;
      log("challenge answered", { id: c.id, index: r.index, ms: answeredAt - r.issuedAt });
    } catch (err) {
      log("challenge missed", { id: c.id, index: r.index, err: String(err) });
    }
  }

  // ───────────── reporting: evidence, 2-of-3 signatures, submit ─────────────

  private async maybeReport(c: Tracked, terms: Terms, status: Status, chainNow: number) {
    const sla = c.sla;
    if (!sla || status.state !== State.ACTIVE || c.reportTx || c.abstained) return;
    if (chainNow < Number(terms.deliveryDeadline) || this.probing.has(c.id)) return;
    if (chainNow > Number(terms.expiry)) return;

    // Missing data never pays out: if the oracle itself was not watching for most of the window, it abstains
    // and the contract expires, instead of blaming the host for the oracle's own outage.
    const expected = maxChallenges(sla, c.windowStart, c.windowEnd);
    if (c.challenges.length < expected - 1) {
      c.abstained = `oracle issued ${c.challenges.length} of ${expected} challenges`;
      log("abstaining", { id: c.id, reason: c.abstained });
      await this.store.save();
      return;
    }

    const evidence = buildEvidence({
      chainId: this.env.deployment.chainId,
      contractId: c.id,
      slaHash: terms.slaHash,
      windowStart: c.windowStart,
      windowEnd: c.windowEnd,
      difficultyBits: sla.difficultyBits,
      requiredSolves: sla.requiredSolves,
      challenges: c.challenges,
    });
    const hash = evidenceHash(evidence);
    await this.store.saveEvidence(hash, evidence, canonicalJson(evidence));

    const report: IncidentReport = {
      contractId: BigInt(c.id),
      incidentId: keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [BigInt(c.id), hash])),
      outcome: outcomeOf(evidence.verdict),
      evidenceHash: hash,
      observedAt: BigInt(chainNow),
      validUntil: BigInt(chainNow + 3_600),
    };
    const domain = reportDomain(this.env.deployment.chainId, this.env.deployment.oracle);
    const signed = await Promise.all(
      this.env.signers.map(async (s) => ({
        address: s.address.toLowerCase(),
        sig: await s.signTypedData({ domain, types: reportTypes, primaryType: "IncidentReport", message: report }),
      })),
    );
    signed.sort((a, b) => (a.address < b.address ? -1 : 1)); // the verifier requires ascending signers

    const tx = await this.send("submitReport", [report, signed.map((s) => s.sig)]);
    c.evidenceHash = hash;
    c.reportTx = tx;
    await this.store.save();
    log("report submitted", { id: c.id, verdict: evidence.verdict, solved: evidence.solved, hash, tx });
  }

  // ───────────── keeper: permissionless transitions, so funds never wait on a person ─────────────

  private async keep(c: Tracked, terms: Terms, s: Status, now: number) {
    const id = BigInt(c.id);
    if (!s.unsoldReleased && now >= Number(terms.saleEnd) && (s.state === State.OPEN || s.state === State.ACTIVE))
      return void (await this.send("releaseUnsold", [id], c.id));
    if (s.state === State.REVIEW && now >= Number(s.challengeEnd)) return void (await this.send("finalize", [id], c.id));
    if (s.state === State.DISPUTED && now > Number(s.resolveBy)) return void (await this.send("finalize", [id], c.id));
    if (s.state === State.ACTIVE && now > Number(terms.expiry)) return void (await this.send("expire", [id], c.id));
    if (s.state === State.DELIVERED && now >= Number(terms.expiry)) return void (await this.send("expire", [id], c.id));
  }

  private async send(functionName: "submitReport" | "finalize" | "expire" | "releaseUnsold", args: readonly unknown[], id?: string) {
    const call = {
      address: this.env.deployment.market,
      abi: computeMarketAbi,
      functionName,
      args,
      account: this.env.submitter,
    } as const;
    // Monad bills the gas limit, so size it to the call instead of a blanket ceiling.
    // biome-ignore lint: viem's overloads cannot narrow a union of function names
    const estimate = await this.env.pub.estimateContractGas(call as any);
    const hash = await this.env.wallet.writeContract({ ...(call as any), gas: (estimate * 12n) / 10n, chain: this.env.chain });
    const receipt = await this.env.pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
    if (id) log(`${functionName} sent`, { id, tx: hash });
    return hash;
  }
}
