/**
 * HYPERHEDGE delivery agent. Runs on the host that sells compute.
 *
 * The oracle sends block-seeded challenges during a contract's delivery window. For each one the host must
 * find a nonce such that sha256(seed ‖ nonce) has `difficultyBits` leading zero bits. That takes real compute
 * on this machine, and the answer is checkable by anyone with one hash. If this process is down, slow or
 * starved, challenges go unanswered and the oracle's evidence shows a delivery failure.
 *
 * POST /solve  { seed: 0x…32 bytes, difficultyBits }  ->  { nonce, hashes, ms }
 * GET  /health                                         ->  { ok, computeClass, cores }
 */
import { cpus } from "node:os";

const PORT = Number(process.env.AGENT_PORT ?? 8795);
const COMPUTE_CLASS = process.env.COMPUTE_CLASS ?? "compute host";
const MAX_BITS = 28;
const MAX_MS = Number(process.env.AGENT_MAX_MS ?? 30_000);

let busy = false;

function leadingZeroBits(d: Uint8Array): number {
  let n = 0;
  for (const b of d) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

function solve(seed: Uint8Array, bits: number): { nonce: bigint; hashes: number } | undefined {
  const buf = new Uint8Array(40);
  buf.set(seed, 0);
  const view = new DataView(buf.buffer);
  const out = new Uint8Array(64); // Bun's digest(target) needs ≥ 64 bytes; sha256 fills the first 32
  const started = Date.now();
  for (let i = 0; ; i++) {
    view.setBigUint64(32, BigInt(i), false);
    const h = new Bun.CryptoHasher("sha256").update(buf).digest(out);
    if (leadingZeroBits((h as Uint8Array).subarray(0, 32)) >= bits) return { nonce: BigInt(i), hashes: i + 1 };
    if ((i & 0xffff) === 0 && Date.now() - started > MAX_MS) return undefined;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, computeClass: COMPUTE_CLASS, cores: cpus().length, busy });
    }
    if (req.method === "POST" && url.pathname === "/solve") {
      let body: { seed?: string; difficultyBits?: number };
      try {
        body = await req.json();
      } catch {
        return json({ error: "bad json" }, 400);
      }
      const { seed, difficultyBits } = body;
      if (typeof seed !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(seed)) return json({ error: "bad seed" }, 400);
      if (!Number.isInteger(difficultyBits) || difficultyBits! < 1 || difficultyBits! > MAX_BITS)
        return json({ error: "bad difficulty" }, 400);
      if (busy) return json({ error: "busy" }, 429); // one proof at a time: the host's real capacity
      busy = true;
      const started = Date.now();
      try {
        const r = solve(Buffer.from(seed.slice(2), "hex"), difficultyBits!);
        if (!r) return json({ error: "timeout" }, 503);
        return json({ nonce: r.nonce.toString(), hashes: r.hashes, ms: Date.now() - started });
      } finally {
        busy = false;
      }
    }
    return json({ error: "not found" }, 404);
  },
});

console.log(JSON.stringify({ msg: "agent up", port: PORT, computeClass: COMPUTE_CLASS }));
