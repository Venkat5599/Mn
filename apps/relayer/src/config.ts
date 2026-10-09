import { parseDeployment, type Deployment } from "@pitchside/shared";
import type { Hex } from "viem";

export interface RelayerConfig {
  chainId: number;
  rpcUrl: string;
  privateKey: Hex;
  deployment: Deployment;
  gamePk: number;
  pollMs: number;
  creTriggerUrl?: string;
  stateDir: string;
  drip: {
    port: number;
    wei: bigint;
    dailyCapWei: bigint;
    allowedOrigin: string;
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}. See apps/relayer/.env.example`);
  return v;
}

export async function loadConfig(): Promise<RelayerConfig> {
  const deploymentFile = required("DEPLOYMENT_FILE");
  const deployment = parseDeployment(await Bun.file(deploymentFile).json());
  const chainId = Number(required("CHAIN_ID"));
  if (deployment.chainId !== chainId) {
    throw new Error(`DEPLOYMENT_FILE is for chain ${deployment.chainId}, CHAIN_ID is ${chainId}`);
  }
  const privateKey = required("RELAYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("RELAYER_PRIVATE_KEY must be a 32-byte hex key");

  return {
    chainId,
    rpcUrl: required("RPC_URL"),
    privateKey: privateKey as Hex,
    deployment,
    gamePk: Number(required("GAME_PK")),
    pollMs: Number(process.env.POLL_MS ?? 1000),
    creTriggerUrl: process.env.CRE_TRIGGER_URL || undefined,
    stateDir: process.env.STATE_DIR ?? ".state",
    drip: {
      port: Number(process.env.DRIP_PORT ?? 8787),
      wei: BigInt(process.env.DRIP_WEI ?? "50000000000000000"),
      dailyCapWei: BigInt(process.env.DRIP_DAILY_CAP_WEI ?? "5000000000000000000"),
      allowedOrigin: process.env.DRIP_ALLOWED_ORIGIN ?? "http://localhost:3000",
    },
  };
}
