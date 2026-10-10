import { priceProtectionPoolAbi } from "@hyperhedge/sdk";
import { join } from "node:path";
import { keccak256, toHex, type Address, type Hex } from "viem";
import { log, type Env } from "./env";

/** Feed id the pool was deployed with: keccak256("MON/USD"). */
export const MON_USD = keccak256(toHex("MON/USD"));
const SOURCE = "https://api.exchange.coinbase.com/products/MON-USD";
const KEEP_SEC = 2 * 24 * 3600;
const SETTLE_WINDOW = 600;

interface Sample {
  /** chain timestamp of the block current when the exchange price was read: never ahead of the chain */
  t: number;
  /** 1e8 fixed point */
  price: number;
}

const priceTypes = {
  PriceReport: [
    { name: "feedId", type: "bytes32" },
    { name: "price", type: "int64" },
    { name: "publishTime", type: "uint64" },
  ],
} as const;

/**
 * Samples MON/USD from Coinbase, signs quorum price reports on request, and settles expired pool positions.
 * The signers attest "this was the exchange price at this chain time"; the pool verifies 2 of 3 onchain.
 */
export class PriceOracle {
  private samples: Sample[] = [];
  private candleCache = new Map<string, { at: number; body: string }>();
  private readonly file: string;

  constructor(
    private readonly env: Env,
    private readonly pool: Address | undefined,
  ) {
    this.file = join(env.stateDir, "prices.json");
  }

  async load() {
    const f = Bun.file(this.file);
    if (await f.exists()) this.samples = ((await f.json()) as Sample[]).slice(-50_000);
  }

  async sample() {
    const [res, head] = await Promise.all([
      fetch(`${SOURCE}/ticker`, { headers: { "user-agent": "hyperhedge-oracle" }, signal: AbortSignal.timeout(5_000) }),
      this.env.pub.getBlock({ blockTag: "latest" }),
    ]);
    if (!res.ok) throw new Error(`exchange HTTP ${res.status}`);
    const { price } = (await res.json()) as { price: string };
    const p = Math.round(Number(price) * 1e8);
    if (!Number.isFinite(p) || p <= 0) throw new Error(`bad price ${price}`);
    const t = Number(head.timestamp);
    if (this.samples.at(-1)?.t === t) return;
    this.samples.push({ t, price: p });
    const cutoff = t - KEEP_SEC;
    while (this.samples.length && this.samples[0]!.t < cutoff) this.samples.shift();
    if (this.samples.length % 12 === 0) await Bun.write(this.file, JSON.stringify(this.samples));
  }

  latest() {
    return this.samples.at(-1);
  }

  /** First sample at or after `ts`, if one exists within the pool's settlement window. */
  at(ts: number) {
    return this.samples.find((s) => s.t >= ts && s.t <= ts + SETTLE_WINDOW);
  }

  history(sinceSec: number) {
    return this.samples.filter((s) => s.t >= sinceSec);
  }

  async sign(s: Sample) {
    const report = { feedId: MON_USD, price: BigInt(s.price), publishTime: BigInt(s.t) };
    const domain = { name: "HYPERHEDGE Price", version: "1", chainId: this.env.deployment.chainId, verifyingContract: this.pool! } as const;
    const signed = await Promise.all(
      this.env.signers.map(async (k) => ({
        a: k.address.toLowerCase(),
        sig: await k.signTypedData({ domain, types: priceTypes, primaryType: "PriceReport", message: report }),
      })),
    );
    signed.sort((x, y) => (x.a < y.a ? -1 : 1));
    return { report: { feedId: MON_USD, price: s.price, publishTime: s.t }, sigs: signed.map((x) => x.sig as Hex) };
  }

  async candles(granularity: string) {
    if (!["300", "900", "3600", "21600"].includes(granularity)) throw new Error("bad granularity");
    const hit = this.candleCache.get(granularity);
    if (hit && Date.now() - hit.at < 30_000) return hit.body;
    const res = await fetch(`${SOURCE}/candles?granularity=${granularity}`, {
      headers: { "user-agent": "hyperhedge-oracle" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`exchange HTTP ${res.status}`);
    const body = await res.text();
    this.candleCache.set(granularity, { at: Date.now(), body });
    return body;
  }

  /** Keeper: settle every expired, unsettled position once a price inside its window exists. */
  async keep() {
    if (!this.pool) return;
    const next = await this.env.pub.readContract({ address: this.pool, abi: priceProtectionPoolAbi, functionName: "nextId" });
    for (let id = 1n; id < next; id++) {
      const p = await this.env.pub.readContract({ address: this.pool, abi: priceProtectionPoolAbi, functionName: "position", args: [id] });
      if (p.settled) continue;
      const s = this.at(Number(p.expiry));
      if (!s) continue;
      const { report, sigs } = await this.sign(s);
      const args = [id, { feedId: report.feedId, price: BigInt(report.price), publishTime: BigInt(report.publishTime) }, sigs] as const;
      const gas = await this.env.pub.estimateContractGas({ address: this.pool, abi: priceProtectionPoolAbi, functionName: "settle", args, account: this.env.submitter });
      const hash = await this.env.wallet.writeContract({ address: this.pool, abi: priceProtectionPoolAbi, functionName: "settle", args, gas: (gas * 12n) / 10n, chain: this.env.chain });
      await this.env.pub.waitForTransactionReceipt({ hash });
      log("price position settled", { id, price: report.price, tx: hash });
    }
  }
}
