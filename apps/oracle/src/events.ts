import { collateralVaultAbi, computeMarketAbi, priceProtectionPoolAbi } from "@hyperhedge/sdk";
import { join } from "node:path";
import { decodeEventLog, type Abi, type Address, type Hex } from "viem";
import { log, type Env } from "./env";

export interface IndexedEvent {
  source: "market" | "vault" | "pool";
  name: string;
  tx: Hex;
  block: number;
  ts: number;
  logIndex: number;
  args: Record<string, string>;
}

const CHUNK = 100n; // public RPC eth_getLogs cap
const PER_TICK = 40; // chunks per tick, so a cold start catches up without starving the other loops

/** Every event the protocol's contracts emit, from deployment onward, decoded and kept on disk. */
export class EventIndex {
  events: IndexedEvent[] = [];
  private cursor: number;
  private readonly file: string;
  private readonly sources: { address: Address; abi: Abi; source: IndexedEvent["source"] }[];

  constructor(private readonly env: Env) {
    this.file = join(env.stateDir, "events.json");
    this.cursor = env.deployment.startBlock - 1;
    const d = env.deployment;
    this.sources = [
      { address: d.market, abi: computeMarketAbi as Abi, source: "market" },
      { address: d.vault, abi: collateralVaultAbi as Abi, source: "vault" },
      ...(d.pricePool ? [{ address: d.pricePool, abi: priceProtectionPoolAbi as Abi, source: "pool" as const }] : []),
    ];
  }

  async load() {
    const f = Bun.file(this.file);
    if (!(await f.exists())) return;
    const s = (await f.json()) as { cursor: number; events: IndexedEvent[] };
    this.cursor = s.cursor;
    this.events = s.events;
  }

  async tick() {
    const latest = await this.env.logsPub.getBlockNumber();
    let from = BigInt(this.cursor + 1);
    let n = 0;
    const fresh: IndexedEvent[] = [];
    while (from <= latest && n++ < PER_TICK) {
      const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
      const logs = await this.env.logsPub.getLogs({ address: this.sources.map((s) => s.address), fromBlock: from, toBlock: to });
      for (const l of logs) {
        const src = this.sources.find((s) => s.address.toLowerCase() === l.address.toLowerCase());
        if (!src) continue;
        try {
          const d = decodeEventLog({ abi: src.abi, data: l.data, topics: l.topics });
          fresh.push({
            source: src.source,
            name: d.eventName ?? "unknown",
            tx: l.transactionHash!,
            block: Number(l.blockNumber),
            ts: 0,
            logIndex: l.logIndex ?? 0,
            args: flatten(d.args as unknown as Record<string, unknown>),
          });
        } catch {
          // an event from an ABI we do not ship (e.g. OpenZeppelin internals): skip it
        }
      }
      this.cursor = Number(to);
      from = to + 1n;
    }
    if (fresh.length) {
      const blocks = [...new Set(fresh.map((e) => e.block))];
      const times = new Map<number, number>();
      for (const b of blocks) times.set(b, Number((await this.env.pub.getBlock({ blockNumber: BigInt(b) })).timestamp));
      for (const e of fresh) e.ts = times.get(e.block) ?? 0;
      this.events.push(...fresh);
      log("events indexed", { count: fresh.length, cursor: this.cursor });
    }
    await Bun.write(this.file, JSON.stringify({ cursor: this.cursor, events: this.events }));
  }

  behind(head: number) {
    return head - this.cursor;
  }
}

function flatten(args: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (typeof v === "bigint" || typeof v === "number" || typeof v === "boolean") out[k] = String(v);
    else if (typeof v === "string") out[k] = v;
    else if (v && typeof v === "object") out[k] = JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
  }
  return out;
}
