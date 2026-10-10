import { GAS, dripDay, dripMessage } from "@pitchside/sdk";
import { getAddress, isAddress, verifyMessage, type Address, type Hex } from "viem";
import { confirm, type Chainish } from "./chain";
import { log } from "./log";

export interface DripOptions {
  port: number;
  wei: bigint;
  dailyCapWei: bigint;
  allowedOrigin: string;
}

const today = () => dripDay();
const MAX_PER_ACCOUNT = 4;

/**
 * Sends a small MON drip to a fresh room key so it can pay gas for bets.
 * Limits: MAX_PER_ACCOUNT drips per main account per day (its own address plus room keys), one per
 * target, skip targets that already hold enough, and a global daily cap.
 * Sybil note: a determined user can mint EOAs; the daily cap bounds the loss. Testnet-grade by design.
 */
export function startDripServer(c: Chainish, opts: DripOptions) {
  let day = today();
  let spent = 0n;
  const perAccount = new Map<string, number>();
  const targets = new Set<string>();

  const cors = {
    "access-control-allow-origin": opts.allowedOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  const server = Bun.serve({
    port: opts.port,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      if (url.pathname === "/health") return reply(200, { ok: true, spentToday: spent.toString() });
      if (url.pathname !== "/drip" || req.method !== "POST") return reply(404, { error: "not found" });

      if (today() !== day) {
        day = today();
        spent = 0n;
        perAccount.clear();
        targets.clear();
      }

      let body: { target?: string; mainAccount?: string; signature?: string };
      try {
        body = await req.json();
      } catch {
        return reply(400, { error: "bad json" });
      }
      const { target: roomKey, mainAccount, signature } = body;
      if (!roomKey || !mainAccount || !signature || !isAddress(roomKey) || !isAddress(mainAccount)) {
        return reply(400, { error: "target, mainAccount and signature are required" });
      }

      const ok = await verifyMessage({
        address: mainAccount,
        message: dripMessage(roomKey, day),
        signature: signature as Hex,
      }).catch(() => false);
      if (!ok) return reply(401, { error: "signature does not match mainAccount" });

      const who = getAddress(mainAccount);
      const target = getAddress(roomKey);
      const used = perAccount.get(who) ?? 0;
      if (used >= MAX_PER_ACCOUNT) return reply(429, { error: "daily drip limit for this account reached" });
      if (targets.has(target)) return reply(429, { error: "this address was already funded today" });
      if (spent + opts.wei > opts.dailyCapWei) return reply(503, { error: "daily drip budget used up" });

      const balance = await c.pub.getBalance({ address: roomKey });
      if (balance >= opts.wei) return reply(200, { skipped: true, reason: "already funded" });

      perAccount.set(who, used + 1);
      targets.add(target);
      spent += opts.wei;
      try {
        const hash = await c.wallet.sendTransaction({ to: roomKey, value: opts.wei, gas: GAS.transfer });
        await confirm(c, hash, "drip");
        log.info("drip sent", { roomKey, mainAccount: who, wei: opts.wei, hash });
        return reply(200, { hash });
      } catch (err) {
        perAccount.set(who, used);
        targets.delete(target);
        spent -= opts.wei;
        log.error("drip failed", { roomKey, err: String(err) });
        return reply(502, { error: "drip transaction failed" });
      }
    },
  });
  log.info("drip server listening", { port: server.port });
  return server;
}
