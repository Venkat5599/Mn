import { getAddress, type Address } from "viem";

/** Written by `bun run deploy` into deployments/<chainId>.json. */
export interface Deployment {
  chainId: number;
  pitchOracle: Address;
  pitchsideRooms: Address;
  stakeToken: Address;
  /** true when stakeToken is the test-only MockAUSD */
  mockStakeToken: boolean;
  /** first block to index from */
  startBlock: number;
}

export function parseDeployment(raw: unknown): Deployment {
  const d = raw as Record<string, unknown>;
  const addr = (k: string) => {
    const v = d[k];
    if (typeof v !== "string") throw new Error(`deployment: missing ${k}`);
    return getAddress(v);
  };
  return {
    chainId: Number(d.chainId),
    pitchOracle: addr("pitchOracle"),
    pitchsideRooms: addr("pitchsideRooms"),
    stakeToken: addr("stakeToken"),
    mockStakeToken: Boolean(d.mockStakeToken),
    startBlock: Number(d.startBlock ?? 0),
  };
}
