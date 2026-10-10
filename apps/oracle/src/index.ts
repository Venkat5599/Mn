/**
 * HYPERHEDGE oracle: watches every contract, challenges the seller's host with block-seeded proofs of work
 * during the delivery window, builds the evidence, signs a 2-of-3 report and submits it. It also runs the
 * permissionless keeper transitions so funds never wait on a person.
 *
 * HTTP (read-only, for the web app):
 *   GET /health
 *   GET /contracts            what the oracle is tracking, with challenge progress
 *   GET /contracts/:id        one contract, every challenge so far
 *   GET /evidence/:hash       the exact evidence file whose keccak256 is onchain
 */
import { loadEnv, log } from "./env";
import { Oracle } from "./oracle";
import { PriceOracle } from "./price";
import { Store } from "./store";

const env = await loadEnv();
const store = await Store.open(env.stateDir, env.deployment.startBlock);
const oracle = new Oracle(env, store);
const prices = new PriceOracle(env, env.deployment.pricePool);
await prices.load();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" },
  });

const summary = (c: ReturnType<typeof store.contracts.get> & object) => ({
  id: c.id,
  sla: c.sla,
  slaError: c.slaError,
  windowStart: c.windowStart,
  windowEnd: c.windowEnd,
  issued: c.challenges.length,
  answered: c.challenges.filter((x) => x.nonce !== null).length,
  evidenceHash: c.evidenceHash,
  reportTx: c.reportTx,
  abstained: c.abstained,
});

const server = Bun.serve({
  port: env.port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return json({ ok: true, signers: env.signers.map((s) => s.address), chainId: env.deployment.chainId });
    if (pathname === "/contracts") return json([...store.contracts.values()].map(summary));
    const contract = pathname.match(/^\/contracts\/(\d+)$/);
    if (contract) {
      const c = store.contracts.get(contract[1]!);
      return c ? json({ ...summary(c), challenges: c.challenges }) : json({ error: "unknown contract" }, 404);
    }
    if (pathname === "/price/latest") {
      const s = prices.latest();
      return s ? json(await prices.sign(s)) : json({ error: "no price yet" }, 503);
    }
    const at = pathname.match(/^\/price\/at\/(\d+)$/);
    if (at) {
      const s = prices.at(Number(at[1]));
      return s ? json(await prices.sign(s)) : json({ error: "no sample in the settlement window" }, 404);
    }
    const params = new URL(req.url).searchParams;
    if (pathname === "/price/history") return json(prices.history(Number(params.get("since") ?? 0)));
    if (pathname === "/price/candles") {
      try {
        return new Response(await prices.candles(params.get("granularity") ?? "3600"), {
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        });
      } catch (e) {
        return json({ error: String(e) }, 502);
      }
    }
    const ev = pathname.match(/^\/evidence\/(0x[0-9a-f]{64})$/);
    if (ev) {
      const f = store.evidenceFile(ev[1]!);
      if (!f || !(await f.exists())) return json({ error: "no such evidence" }, 404);
      return new Response(f, { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
    }
    return json({ error: "not found" }, 404);
  },
});

log("oracle up", { port: env.port, market: env.deployment.market, submitter: env.submitter.address });

// price sampling every 5 s and pool settlement every 30 s, independent of the delivery loop
let lastKeep = 0;
const priceTimer = setInterval(async () => {
  try {
    await prices.sample();
    if (Date.now() - lastKeep > 30_000) {
      lastKeep = Date.now();
      await prices.keep();
    }
  } catch (err) {
    log("price tick failed", { err: String(err) });
  }
}, 5_000);

let running = true;
process.on("SIGTERM", () => (running = false));
process.on("SIGINT", () => (running = false));
while (running) {
  const started = Date.now();
  try {
    await oracle.tick();
  } catch (err) {
    log("tick failed", { err: String(err) });
  }
  await Bun.sleep(Math.max(0, env.tickMs - (Date.now() - started)));
}
clearInterval(priceTimer);
server.stop();
await store.save();
process.exit(0);
