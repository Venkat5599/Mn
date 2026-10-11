/**
 * Real dispute run on Monad testnet, from three fresh wallets. Nothing here is simulated:
 *   1. Three brand-new wallets each get MON for gas, pull hhUSD from the token faucet themselves, approve and
 *      buy one unit. The script times each wallet from its first transaction to its confirmed purchase.
 *   2. The contract's SLA names a host that never answers, so every challenge is missed and the live oracle
 *      reports FAILURE with a 2-of-3 signed report.
 *   3. The seller disputes that valid FAILURE (frivolous) and posts the bond from its free balance.
 *   4. The guardian upholds the report. The bond is slashed to the buyers, the contract settles, and each
 *      buyer claims payout + its share of the bond.
 *   5. The vault reconciles.
 *
 * env (.env at the repo root): DEPLOYER_PRIVATE_KEY (seller and guardian), MONAD_TESTNET_RPC_URL
 */
import {
  State,
  STATE_LABEL,
  collateralVaultAbi,
  computeMarketAbi,
  monadTestnet,
  slaHash,
  slaToUri,
  txUrl,
  type Deployment,
  type Sla,
} from "@hyperhedge/sdk";
import { createPublicClient, createWalletClient, http, parseEther, stringToHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const d = (await Bun.file(new URL("../../../deployments/10143.json", import.meta.url)).json()) as Deployment;
const rpc = process.env.MONAD_TESTNET_RPC_URL ?? monadTestnet.rpcUrls.default.http[0]!;
const pub = createPublicClient({ chain: monadTestnet, transport: http(rpc, { retryCount: 3 }) });
const seller = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const wallet = (acct: PrivateKeyAccount) => createWalletClient({ chain: monadTestnet, account: acct, transport: http(rpc) });

// Fresh buyer keys are kept (gitignored) so MON sent to them is never stranded by a failed run.
const keysFile = Bun.file(new URL(`../.state/fresh-buyers-${Date.now()}.json`, import.meta.url));
const buyers = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()));
await Bun.write(keysFile, JSON.stringify(buyers.map((b) => b.address)));

const USD = 1_000_000n;
const tokenAbi = [
  { type: "function", name: "faucet", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const step = (label: string, hash: Hex) => console.log(`  ${label.padEnd(30)} ${txUrl(d.chainId, hash) ?? hash}`);
const bal = (a: Hex) => pub.readContract({ address: d.token, abi: tokenAbi, functionName: "balanceOf", args: [a] });

async function send(acct: PrivateKeyAccount, label: string, req: Record<string, unknown>) {
  const gas = await pub.estimateContractGas({ ...(req as any), account: acct });
  const hash = await wallet(acct).writeContract({ ...(req as any), gas: (gas * 13n) / 10n, chain: monadTestnet });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted ${hash}`);
  step(label, hash);
  return r;
}

const now = async () => Number((await pub.getBlock()).timestamp);
const status = (id: bigint) => pub.readContract({ address: d.market, abi: computeMarketAbi, functionName: "status", args: [id] });

async function waitFor(id: bigint, states: number[], timeoutSec: number) {
  const until = Date.now() + timeoutSec * 1000;
  let last = -1;
  while (Date.now() < until) {
    const s = await status(id);
    if (s.state !== last) console.log(`  contract ${id}: ${STATE_LABEL[s.state as State]}`);
    last = s.state;
    if (states.includes(s.state)) return s;
    await Bun.sleep(4_000);
  }
  throw new Error(`contract ${id} did not reach ${states.map((s) => STATE_LABEL[s as State]).join("/")}`);
}

console.log(`HYPERHEDGE dispute run on Monad testnet · market ${d.market}`);
console.log(`seller and guardian ${seller.address}`);
console.log(`fresh buyers ${buyers.map((b) => b.address).join(", ")}\n`);

// ── seller: collateral for 3 units plus room for the dispute bond ──
const sla: Sla = {
  v: 1,
  kind: "pow-delivery",
  computeClass: "Demo host that never answers (failure scenario)",
  host: "http://127.0.0.1:1",
  difficultyBits: 20,
  requiredSolves: 4,
  intervalSec: 15,
  answerWithinSec: 10,
};
const UNITS = 3n;
const PAYOUT = 100n * USD;
const PREMIUM = 10n * USD;
const bondMax = (UNITS * PAYOUT) / 10n; // policy: 10% of M, min 10
const need = UNITS * PAYOUT + bondMax;

console.log("seller setup");
const free = await pub.readContract({ address: d.vault, abi: collateralVaultAbi, functionName: "free", args: [seller.address] });
if (free < need) {
  if ((await bal(seller.address)) < need - free) {
    try {
      await send(seller, "hhUSD faucet (seller)", { address: d.token, abi: tokenAbi, functionName: "faucet" });
    } catch {
      throw new Error("seller needs more hhUSD and the faucet is on cooldown");
    }
  }
  await send(seller, "approve vault (seller)", { address: d.token, abi: tokenAbi, functionName: "approve", args: [d.vault, need - free] });
  await send(seller, "deposit collateral", { address: d.vault, abi: collateralVaultAbi, functionName: "deposit", args: [need - free] });
}

const t0 = await now();
const saleEnd = t0 + 150;
const deadline = saleEnd + 90;
const terms = {
  seller: seller.address,
  underlying: stringToHex("H100-80GB-GPUh", { size: 32 }),
  quantity: 3_000n,
  slaHash: slaHash(sla),
  units: UNITS,
  payoutPerUnit: PAYOUT,
  premiumPerUnit: PREMIUM,
  feeBps: 0,
  saleEnd: BigInt(saleEnd),
  deliveryDeadline: BigInt(deadline),
  expiry: BigInt(deadline + 1_500),
  policyId: d.policyId,
};
const r = await send(seller, "create (3 units)", { address: d.market, abi: computeMarketAbi, functionName: "create", args: [terms, slaToUri(sla)] });
const created = r.logs.find((l) => l.address.toLowerCase() === d.market.toLowerCase() && l.topics.length > 2);
const id = BigInt(created!.topics[1]!);
console.log(`  contract ${id}: sale closes ${new Date(saleEnd * 1000).toISOString()}`);

// ── three fresh wallets, the same path a judge takes: gas, faucet, approve, buy ──
console.log("\nfresh wallets buy");
for (const b of buyers) {
  const h = await wallet(seller).sendTransaction({ to: b.address, value: parseEther("0.15"), chain: monadTestnet });
  await pub.waitForTransactionReceipt({ hash: h });
  step(`MON gas to ${b.address.slice(0, 8)}`, h);
}
const timings = await Promise.all(
  buyers.map(async (b, i) => {
    const started = Date.now();
    await send(b, `buyer ${i + 1} faucet`, { address: d.token, abi: tokenAbi, functionName: "faucet" });
    await send(b, `buyer ${i + 1} approve`, { address: d.token, abi: tokenAbi, functionName: "approve", args: [d.vault, PREMIUM] });
    await send(b, `buyer ${i + 1} buy 1 unit`, { address: d.market, abi: computeMarketAbi, functionName: "buy", args: [id, 1n, PREMIUM] });
    return (Date.now() - started) / 1000;
  }),
);
timings.forEach((s, i) => console.log(`  buyer ${i + 1}: faucet → confirmed purchase in ${s.toFixed(1)} s`));

// ── the oracle challenges a host that never answers, then reports FAILURE ──
console.log("\noracle evaluates the window");
const review = await waitFor(id, [State.REVIEW], 900);
console.log(`  report accepted: ${review.outcome === 1 ? "FAILURE" : "DELIVERED"} · evidence ${review.evidenceHash}`);
if (review.outcome !== 1) throw new Error("expected a FAILURE report");

// ── frivolous dispute by the seller, then the guardian upholds the report ──
console.log("\nseller disputes a valid failure");
const bond = await pub.readContract({ address: d.market, abi: computeMarketAbi, functionName: "disputeBond", args: [id] });
await send(seller, `dispute (bond ${bond / USD} hhUSD)`, { address: d.market, abi: computeMarketAbi, functionName: "dispute", args: [id] });
await send(seller, "guardian upholds FAILURE", { address: d.market, abi: computeMarketAbi, functionName: "resolve", args: [id, 1, false] });
const s = await status(id);
console.log(`  contract ${id}: ${STATE_LABEL[s.state as State]} · bond share per unit ${Number(s.bondPerUnit) / 1e6} hhUSD`);

console.log("\nbuyers claim");
for (const [i, b] of buyers.entries()) {
  const before = await bal(b.address);
  await send(b, `buyer ${i + 1} claim`, { address: d.market, abi: computeMarketAbi, functionName: "claim", args: [id] });
  console.log(`    received ${Number((await bal(b.address)) - before) / 1e6} hhUSD (payout 100 + bond share)`);
}

const [ok, balance, tracked] = await pub.readContract({ address: d.vault, abi: collateralVaultAbi, functionName: "reconcile" });
console.log(`\nvault reconcile: ${ok ? "OK" : "MISMATCH"} (balance ${balance}, tracked ${tracked})`);
if (!ok) process.exit(1);
