import { getAddress, zeroAddress, type Address } from "viem";

// NEXT_PUBLIC_* must be referenced literally so Next can inline them at build time.
const raw = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  oracle: process.env.NEXT_PUBLIC_PITCH_ORACLE,
  rooms: process.env.NEXT_PUBLIC_PITCHSIDE_ROOMS,
  stakeToken: process.env.NEXT_PUBLIC_STAKE_TOKEN,
  stakeTokenIsMock: process.env.NEXT_PUBLIC_STAKE_TOKEN_IS_MOCK,
  deployBlock: process.env.NEXT_PUBLIC_DEPLOY_BLOCK,
  dripUrl: process.env.NEXT_PUBLIC_DRIP_URL,
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL,
  accountMode: process.env.NEXT_PUBLIC_ACCOUNT_MODE,
  mlbApi: process.env.NEXT_PUBLIC_MLB_API,
};

const addr = (v: string | undefined): Address => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? getAddress(v) : zeroAddress);

export const env = {
  chainId: Number(raw.chainId ?? 10143),
  rpcUrl: raw.rpcUrl ?? "https://testnet-rpc.monad.xyz",
  oracle: addr(raw.oracle),
  rooms: addr(raw.rooms),
  stakeToken: addr(raw.stakeToken),
  stakeTokenIsMock: raw.stakeTokenIsMock !== "false",
  deployBlock: BigInt(raw.deployBlock ?? 0),
  dripUrl: raw.dripUrl ?? "",
  indexerUrl: raw.indexerUrl ?? "",
  /**
   * passkey            Mera passkeys only (default, production)
   * passkey-or-device  passkeys, falling back to a device key when the provider has no PRF (dev)
   * device             device key only, for the local simulated game and automated tests
   */
  accountMode: (raw.accountMode === "device" || raw.accountMode === "passkey-or-device" ? raw.accountMode : "passkey") as
    | "passkey"
    | "passkey-or-device"
    | "device",
  /** override only for the local simulated game (scripts/dev-local.ts) */
  mlbApi: raw.mlbApi || "https://statsapi.mlb.com/api",
};

/** False until contract addresses are configured; the UI says so instead of failing silently. */
export const isConfigured = env.oracle !== zeroAddress && env.rooms !== zeroAddress;

/** Button copy follows the real auth method, so a dev build never claims Face ID it isn't using. */
export const authVerb = env.accountMode === "device" ? "" : " with Face ID";
