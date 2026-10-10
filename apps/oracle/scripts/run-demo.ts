/**
 * Real end-to-end run on Monad testnet. Nothing here is simulated:
 *   A (delivered): the host answers every challenge, the oracle reports DELIVERED, the seller is released.
 *   B (failure):   the host's agent is stopped mid-window over SSH, challenges go unanswered, the oracle reports
 *                  FAILURE, and the buyer claims the payout.
 * Prints every transaction and checks the vault reconciles.
 *
 * env (.env at the repo root): DEPLOYER_PRIVATE_KEY, MONAD_TESTNET_RPC_URL
 * args: --only=a|b   --host=http://…:9795   --ssh=root@host  --key=~/.ssh/…
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
import { $ } from "bun";
import { createPublicClient, createWalletClient, http, parseEther, stringToHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const arg = (k: string, d?: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const ONLY = arg("only");
const HOST = arg("host", "http://187.127.137.136:9795")!;
const SSH = arg("ssh", "root@187.127.137.136")!;
const KEY = arg("key", `${process.env.HOME ?? process.env.USERPROFILE}/.ssh/agent_fabric_vps`)!;

const d = (await Bun.file(new URL("../../../deployments/10143.json", import.meta.url)).json()) as Deployment;
const rpc = process.env.MONAD_TESTNET_RPC_URL ?? monadTestnet.rpcUrls.default.http[0]!;
const pub = createPublicClient({ chain: monadTestnet, transport: http(rpc, { retryCount: 3 }) });
const seller = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const buyer = privateKeyToAccount(generatePrivateKey());
const wallet = (acct: typeof seller) => createWalletClient({ chain: monadTestnet, account: acct, transport: http(rpc) });

const USD = 1_000_000n;
const tokenAbi = [
  { type: "function", name: "faucet", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const step = (label: string, hash: Hex) => console.log(`  ${label.padEnd(26)} ${txUrl(d.chainId, hash) ?? hash}`);

async function send(acct: typeof seller, label: string, req: Record<string, unknown>) {
  const w = wallet(acct);
  const gas = await pub.estimateContractGas({ ...(req as any), account: acct });
  const hash = await w.writeContract({ ...(req as any), gas: (gas * 13n) / 10n, chain: monadTestnet });
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
    await Bun.sleep(5_000);
  }
  throw new Error(`contract ${id} did not reach ${states.map((s) => STATE_LABEL[s as State]).join("/")}`);
}

async function create(label: string): Promise<{ id: bigint; deadline: number }> {
  const sla: Sla = {
    v: 1,
    kind: "pow-delivery",
    computeClass: "GPU compute delivery (demo host)",
    host: HOST,
    difficultyBits: 20,
    requiredSolves: 10,
    intervalSec: 15,
    answerWithinSec: 10,
  };
  const t0 = await now();
  const saleEnd = t0 + 75;
  const deadline = saleEnd + 180; // 12 challenges fit; 10 must be proven
  const terms = {
    seller: seller.address,
    underlying: stringToHex("H100-80GB-GPUh", { size: 32 }),
    quantity: 1_000n,
    slaHash: slaHash(sla),
    units: 10n,
    payoutPerUnit: 100n * USD,
    premiumPerUnit: 10n * USD,
    feeBps: 0,
    saleEnd: BigInt(saleEnd),
    deliveryDeadline: BigInt(deadline),
    expiry: BigInt(deadline + 420),
    policyId: d.policyId,
  };
  const r = await send(seller, `create (${label})`, {
    address: d.market,
    abi: computeMarketAbi,
    functionName: "create",
    args: [terms, slaToUri(sla)],
  });
  const created = r.logs.find((l) => l.address.toLowerCase() === d.market.toLowerCase() && l.topics.length > 2);
  const id = BigInt(created!.topics[1]!);
  await send(buyer, `buy 10 units (${label})`, {
    address: d.market,
    abi: computeMarketAbi,
    functionName: "buy",
    args: [id, 10n, 100n * USD],
  });
  console.log(`  contract ${id}: window ${new Date(saleEnd * 1000).toISOString()} → ${new Date(deadline * 1000).toISOString()}`);
  return { id, deadline };
}

console.log(`HYPERHEDGE end-to-end on Monad testnet · market ${d.market}`);
console.log(`seller ${seller.address} · fresh buyer ${buyer.address}\n`);

// ── funding: real faucet, real transfers ──
console.log("funding");
const sw = wallet(seller);
const fund = await sw.sendTransaction({ to: buyer.address, value: parseEther("0.25"), chain: monadTestnet });
await pub.waitForTransactionReceipt({ hash: fund });
step("MON to buyer", fund);
const bal = await pub.readContract({ address: d.token, abi: tokenAbi, functionName: "balanceOf", args: [seller.address] });
if (bal < 3_000n * USD) {
  try {
    await send(seller, "hhUSD faucet (seller)", { address: d.token, abi: tokenAbi, functionName: "faucet" });
  } catch {
    console.log("  faucet on cooldown, using existing balance");
  }
}
await send(seller, "hhUSD to buyer", { address: d.token, abi: tokenAbi, functionName: "transfer", args: [buyer.address, 300n * USD] });
await send(seller, "approve vault (seller)", { address: d.token, abi: tokenAbi, functionName: "approve", args: [d.vault, 2n ** 255n] });
await send(buyer, "approve vault (buyer)", { address: d.token, abi: tokenAbi, functionName: "approve", args: [d.vault, 2n ** 255n] });
const free = await pub.readContract({ address: d.vault, abi: collateralVaultAbi, functionName: "free", args: [seller.address] });
if (free < 2_000n * USD)
  await send(seller, "deposit collateral", { address: d.vault, abi: collateralVaultAbi, functionName: "deposit", args: [2_000n * USD - free] });

// ── A: the host delivers ──
if (ONLY !== "b") {
  console.log("\nA · host delivers");
  const a = await create("A");
  const s = await waitFor(a.id, [State.DELIVERED, State.EXPIRED, State.SETTLED], 900);
  console.log(`  outcome: ${STATE_LABEL[s.state as State]} · evidence ${s.evidenceHash}`);
}

// ── B: the host goes down mid-window ──
if (ONLY !== "a") {
  console.log("\nB · host fails mid-window");
  const b = await create("B");
  const kill = b.deadline - 150; // after ~2 proofs inside the window
  while ((await now()) < kill) await Bun.sleep(3_000);
  await $`ssh -i ${KEY} -o BatchMode=yes ${SSH} systemctl stop hyperhedge-agent`;
  console.log(`  agent stopped on the host at ${new Date().toISOString()}`);
  try {
    await waitFor(b.id, [State.REVIEW], 600);
  } finally {
    await $`ssh -i ${KEY} -o BatchMode=yes ${SSH} systemctl start hyperhedge-agent`;
    console.log("  agent restarted");
  }
  const s = await waitFor(b.id, [State.SETTLED, State.EXPIRED], 900);
  if (s.state === State.SETTLED) {
    const before = await pub.readContract({ address: d.token, abi: tokenAbi, functionName: "balanceOf", args: [buyer.address] });
    await send(buyer, "claim payout", { address: d.market, abi: computeMarketAbi, functionName: "claim", args: [b.id] });
    const after = await pub.readContract({ address: d.token, abi: tokenAbi, functionName: "balanceOf", args: [buyer.address] });
    console.log(`  buyer received ${(after - before) / USD} hhUSD · evidence ${s.evidenceHash}`);
  }
}

const [ok, balance, tracked] = await pub.readContract({ address: d.vault, abi: collateralVaultAbi, functionName: "reconcile" });
console.log(`\nvault reconcile: ${ok ? "OK" : "MISMATCH"} (balance ${balance}, tracked ${tracked})`);
if (!ok) process.exit(1);
