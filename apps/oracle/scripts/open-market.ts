/**
 * Opens a long-running contract so anyone (judges included) can buy protection from a fresh wallet at any time.
 * The SLA names the live demo host; after the sale closes, its delivery window runs like any other contract.
 *
 * env (.env at the repo root): DEPLOYER_PRIVATE_KEY, MONAD_TESTNET_RPC_URL
 * args: --sale-end=2026-10-20T00:00:00Z  --units=18  --payout=50  --premium=4
 */
import { collateralVaultAbi, computeMarketAbi, monadTestnet, slaHash, slaToUri, txUrl, type Deployment, type Sla } from "@hyperhedge/sdk";
import { createPublicClient, createWalletClient, erc20Abi, http, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const saleEnd = Math.floor(Date.parse(arg("sale-end", "2026-10-20T00:00:00Z")) / 1000);
const UNITS = BigInt(arg("units", "18"));
const USD = 1_000_000n;
const PAYOUT = BigInt(arg("payout", "50")) * USD;
const PREMIUM = BigInt(arg("premium", "4")) * USD;

const d = (await Bun.file(new URL("../../../deployments/10143.json", import.meta.url)).json()) as Deployment;
const rpc = process.env.MONAD_TESTNET_RPC_URL ?? monadTestnet.rpcUrls.default.http[0]!;
const pub = createPublicClient({ chain: monadTestnet, transport: http(rpc, { retryCount: 3 }) });
const seller = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const w = createWalletClient({ chain: monadTestnet, account: seller, transport: http(rpc) });

async function send(label: string, req: Record<string, unknown>) {
  const gas = await pub.estimateContractGas({ ...(req as any), account: seller });
  const hash = await w.writeContract({ ...(req as any), gas: (gas * 13n) / 10n, chain: monadTestnet });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted ${hash}`);
  console.log(`  ${label.padEnd(22)} ${txUrl(d.chainId, hash)}`);
  return r;
}

const sla: Sla = {
  v: 1,
  kind: "pow-delivery",
  computeClass: "GPU compute delivery (demo host)",
  host: "http://187.127.137.136:9795",
  difficultyBits: 20,
  requiredSolves: 30,
  intervalSec: 15,
  answerWithinSec: 10,
};
const deadline = saleEnd + 600; // 40 challenges fit; 30 must be proven

const need = UNITS * PAYOUT;
const free = await pub.readContract({ address: d.vault, abi: collateralVaultAbi, functionName: "free", args: [seller.address] });
if (free < need) {
  await send("approve vault", { address: d.token, abi: erc20Abi, functionName: "approve", args: [d.vault, need - free] });
  await send("deposit collateral", { address: d.vault, abi: collateralVaultAbi, functionName: "deposit", args: [need - free] });
}
const terms = {
  seller: seller.address,
  underlying: stringToHex("H100-80GB-GPUh", { size: 32 }),
  quantity: UNITS * 100n,
  slaHash: slaHash(sla),
  units: UNITS,
  payoutPerUnit: PAYOUT,
  premiumPerUnit: PREMIUM,
  feeBps: 0,
  saleEnd: BigInt(saleEnd),
  deliveryDeadline: BigInt(deadline),
  expiry: BigInt(deadline + 3_600),
  policyId: d.policyId,
};
const r = await send("create", { address: d.market, abi: computeMarketAbi, functionName: "create", args: [terms, slaToUri(sla)] });
const id = BigInt(r.logs.find((l) => l.address.toLowerCase() === d.market.toLowerCase() && l.topics.length > 2)!.topics[1]!);
console.log(`contract ${id}: ${UNITS} units open until ${new Date(saleEnd * 1000).toISOString()}`);
