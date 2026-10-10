"use client";

import { collateralVaultAbi, computeMarketAbi, type ChallengeRecord, type Sla } from "@hyperhedge/sdk";
import { useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { ORACLE_API, deployment, pub } from "./chain";

const market = { address: deployment.market, abi: computeMarketAbi } as const;
const vault = { address: deployment.vault, abi: collateralVaultAbi } as const;

export type Terms = Awaited<ReturnType<typeof readTerms>>;
export type Status = Awaited<ReturnType<typeof readStatus>>;

const readTerms = (id: bigint) => pub.readContract({ ...market, functionName: "terms", args: [id] });
const readStatus = (id: bigint) => pub.readContract({ ...market, functionName: "status", args: [id] });

export interface OracleView {
  id: string;
  sla: Sla | null;
  slaError?: string;
  windowStart: number;
  windowEnd: number;
  issued: number;
  answered: number;
  evidenceHash?: Hex;
  reportTx?: Hex;
  abstained?: string;
  challenges?: ChallengeRecord[];
  events?: ChainEvent[];
}

export interface ChainEvent {
  name: string;
  tx: Hex;
  block: number;
  ts: number;
  data: Record<string, string>;
}

export interface ContractRow {
  id: bigint;
  terms: Terms;
  status: Status;
  bond: bigint;
}

// The same loader called from several components (sidebar + page) shares one request and a short cache.
const shared = new Map<unknown, { at: number; p: Promise<unknown> }>();
function dedupe<T>(load: () => Promise<T>, ttl: number): Promise<T> {
  const hit = shared.get(load);
  if (hit && Date.now() - hit.at < ttl) return hit.p as Promise<T>;
  const p = load();
  shared.set(load, { at: Date.now(), p });
  p.catch(() => shared.delete(load));
  return p;
}

/**
 * Polls `load` on an interval; keeps the last good value on transient RPC errors, pauses while the tab is
 * hidden, and dedupes module-level loaders shared across components.
 */
export function usePoll<T>(load: () => Promise<T>, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.hidden) {
        timer = setTimeout(run, ms);
        return;
      }
      try {
        const v = await dedupe(loadRef.current, Math.min(ms, 3_000));
        if (alive) {
          setData(v);
          setError(undefined);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      }
      if (alive) timer = setTimeout(run, ms);
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

export async function loadContracts(): Promise<ContractRow[]> {
  const next = await pub.readContract({ ...market, functionName: "nextId" });
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1)).reverse();
  return Promise.all(
    ids.map(async (id) => {
      const [terms, status, bond] = await Promise.all([
        readTerms(id),
        readStatus(id),
        pub.readContract({ ...market, functionName: "disputeBond", args: [id] }),
      ]);
      return { id, terms, status, bond };
    }),
  );
}

export async function loadContract(id: bigint): Promise<ContractRow> {
  const [terms, status, bond] = await Promise.all([
    readTerms(id),
    readStatus(id),
    pub.readContract({ ...market, functionName: "disputeBond", args: [id] }),
  ]);
  return { id, terms, status, bond };
}

export interface VaultTotals {
  free: bigint;
  reserved: bigint;
  premium: bigint;
  payable: bigint;
  bond: bigint;
  fees: bigint;
  reconciled: boolean;
  balance: bigint;
}

export async function loadVault(): Promise<VaultTotals> {
  const [free, reserved, premium, payable, bond, fees, rec] = await Promise.all([
    pub.readContract({ ...vault, functionName: "totalFree" }),
    pub.readContract({ ...vault, functionName: "totalReserved" }),
    pub.readContract({ ...vault, functionName: "totalPremium" }),
    pub.readContract({ ...vault, functionName: "totalPayable" }),
    pub.readContract({ ...vault, functionName: "totalBond" }),
    pub.readContract({ ...vault, functionName: "fees" }),
    pub.readContract({ ...vault, functionName: "reconcile" }),
  ]);
  return { free, reserved, premium, payable, bond, fees, reconciled: rec[0], balance: rec[1] };
}

export async function loadOracle(): Promise<OracleView[]> {
  const r = await fetch(`${ORACLE_API}/contracts`, { cache: "no-store" });
  if (!r.ok) throw new Error(`oracle HTTP ${r.status}`);
  return r.json();
}

export async function loadOracleContract(id: bigint): Promise<OracleView | undefined> {
  const r = await fetch(`${ORACLE_API}/contracts/${id}`, { cache: "no-store" });
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`oracle HTTP ${r.status}`);
  return r.json();
}

export async function loadPosition(id: bigint, who: Address) {
  return pub.readContract({ ...market, functionName: "balanceOf", args: [who, id] });
}

export const marketContract = market;
export const vaultContract = vault;
