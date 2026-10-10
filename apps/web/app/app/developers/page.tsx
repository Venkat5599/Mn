"use client";

import { addrLink, deployment } from "@/lib/chain";
import { POOL } from "@/lib/pool";
import s from "../pages.module.css";

const CONTRACTS = [
  { name: "ComputeMarket", addr: deployment.market, what: "terms, lifecycle, ERC-1155 positions" },
  { name: "CollateralVault", addr: deployment.vault, what: "every token, in separate buckets; reconcile()" },
  { name: "OracleVerifier", addr: deployment.oracle, what: "2-of-3 EIP-712 incident reports" },
  { name: "PriceProtectionPool", addr: POOL, what: "MON/USD price protection AMM" },
  { name: "TestUSD (hhUSD)", addr: deployment.token, what: "testnet stake token with a faucet" },
];

const API = [
  ["GET /api/oracle/contracts", "every tracked contract with challenge progress"],
  ["GET /api/oracle/contracts/:id", "one contract with every challenge"],
  ["GET /api/oracle/evidence/:hash", "the evidence file whose keccak256 is onchain"],
  ["GET /api/oracle/events?source=market|vault|pool", "decoded onchain events, newest first"],
  ["GET /api/oracle/price/latest", "MON/USD signed by 2 of 3 oracle keys"],
  ["GET /api/oracle/price/candles?granularity=3600", "exchange candles for MON-USD"],
];

const SNIPPET = `import { createPublicClient, http } from "viem";
import { computeMarketAbi, verifyEvidence, slaFromUri } from "@hyperhedge/sdk";

const client = createPublicClient({ transport: http("https://testnet-rpc.monad.xyz") });
const market = "${deployment.market}";

// read a contract's committed terms and state
const terms = await client.readContract({ address: market, abi: computeMarketAbi, functionName: "terms", args: [2n] });
const status = await client.readContract({ address: market, abi: computeMarketAbi, functionName: "status", args: [2n] });

// fetch its evidence and re-check every proof of work yourself
const o = await (await fetch("https://hyperhedge-app.vercel.app/api/oracle/contracts/2")).json();
const evidence = await (await fetch(\`https://hyperhedge-app.vercel.app/api/oracle/evidence/\${o.evidenceHash}\`)).json();
const check = await verifyEvidence(evidence, o.sla, async (n) => (await client.getBlock({ blockNumber: BigInt(n) })).hash);
console.log(check.ok, check.verdict, check.solved);`;

const AGENT = `# run a delivery host: answers proof-of-work challenges with this machine's compute
git clone https://github.com/Venkat5599/Mn && cd Mn
AGENT_PORT=9795 COMPUTE_CLASS="my-gpu-box" bun apps/agent/src/index.ts`;

export default function Developers() {
  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Developer Portal</h1>
        <p>Everything needed to read, verify or build on HYPERHEDGE. Monad testnet, chain id 10143. Source: github.com/Venkat5599/Mn.</p>
      </header>
      <div className={s.two}>
        <section className={`panel ${s.card}`}>
          <h2>Contracts</h2>
          <ul className={s.list}>
            {CONTRACTS.map((c) => (
              <li key={c.name} style={{ display: "grid", gap: 2 }}>
                <span>
                  <b>{c.name}</b> <span className={s.mute}>· {c.what}</span>
                </span>
                <a href={addrLink(c.addr)} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 13 }}>
                  {c.addr}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className={`panel ${s.card}`}>
          <h2>Oracle API</h2>
          <ul className={s.list}>
            {API.map(([e, d]) => (
              <li key={e} style={{ display: "grid", gap: 2 }}>
                <code className="mono" style={{ fontSize: 13 }}>
                  {e}
                </code>
                <span className={s.mute}>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={`panel ${s.card}`}>
        <h2>Verify a settlement from your own code</h2>
        <pre className={s.code}>{SNIPPET}</pre>
      </section>
      <section className={`panel ${s.card}`}>
        <h2>Run your own delivery host</h2>
        <pre className={s.code}>{AGENT}</pre>
        <p className={s.mute}>Name its URL as the host when you issue a contract. The oracle challenges it through the delivery window.</p>
      </section>
    </main>
  );
}
