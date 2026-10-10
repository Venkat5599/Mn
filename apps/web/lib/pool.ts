"use client";

import { priceProtectionPoolAbi } from "@hyperhedge/sdk";
import type { Address, Hex } from "viem";
import { ORACLE_API, pub } from "./chain";

export const POOL = (process.env.NEXT_PUBLIC_PRICE_POOL ?? "0x4dC4E80DaE43f2149B5E104194522550921A71d9") as Address;
export const poolContract = { address: POOL, abi: priceProtectionPoolAbi } as const;
export const P8 = 1e8;

export async function loadPoolState() {
  const [assets, locked, totalShares, vol, next] = await Promise.all([
    pub.readContract({ ...poolContract, functionName: "assets" }),
    pub.readContract({ ...poolContract, functionName: "locked" }),
    pub.readContract({ ...poolContract, functionName: "totalShares" }),
    pub.readContract({ ...poolContract, functionName: "volDailyBps" }),
    pub.readContract({ ...poolContract, functionName: "nextId" }),
  ]);
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const positions = await Promise.all(ids.map(async (id) => ({ id, ...(await pub.readContract({ ...poolContract, functionName: "position", args: [id] })) })));
  return { assets, locked, totalShares, vol, positions: positions.reverse() };
}

export interface IndexedEvent {
  source: "market" | "vault" | "pool";
  name: string;
  tx: Hex;
  block: number;
  ts: number;
  args: Record<string, string>;
}

export async function loadEvents(source?: string, limit = 300): Promise<{ total: number; events: IndexedEvent[] }> {
  const r = await fetch(`${ORACLE_API}/events?limit=${limit}${source ? `&source=${source}` : ""}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`events HTTP ${r.status}`);
  return r.json();
}

export async function loadSignedPrice(): Promise<{ report: { feedId: Hex; price: number; publishTime: number }; sigs: Hex[] }> {
  const r = await fetch(`${ORACLE_API}/price/latest`, { cache: "no-store" });
  if (!r.ok) throw new Error(`price HTTP ${r.status}`);
  return r.json();
}
