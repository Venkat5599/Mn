import { chainFor, type Deployment } from "@hyperhedge/sdk";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export async function loadEnv() {
  const deploymentPath = process.env.DEPLOYMENT_PATH ?? new URL("../../../deployments/10143.json", import.meta.url).pathname;
  const deployment = (await Bun.file(deploymentPath).json()) as Deployment;
  const chain = chainFor(deployment.chainId);
  const rpc = process.env.RPC_URL ?? chain.rpcUrls.default.http[0]!;

  const submitter = privateKeyToAccount(need("DEPLOYER_PRIVATE_KEY") as Hex);
  // Reports need a quorum (2 of 3). The oracle signs with the first two; the third is the policy's spare.
  const signers = [need("SIGNER_1_PRIVATE_KEY"), need("SIGNER_2_PRIVATE_KEY")].map((k) =>
    privateKeyToAccount(k as Hex),
  );

  return {
    deployment,
    chain,
    pub: createPublicClient({ chain, transport: http(rpc, { retryCount: 3, timeout: 15_000 }) }),
    wallet: createWalletClient({ chain, account: submitter, transport: http(rpc, { retryCount: 2, timeout: 20_000 }) }),
    submitter,
    signers,
    port: Number(process.env.ORACLE_PORT ?? 9796),
    stateDir: process.env.STATE_DIR ?? ".state",
    tickMs: Number(process.env.TICK_MS ?? 2_000),
  };
}

export type Env = Awaited<ReturnType<typeof loadEnv>>;

export const log = (msg: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...data }, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
