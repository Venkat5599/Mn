import { env } from "./env";

/**
 * Stakes rooms: always on with the testnet mock token (no real money moves);
 * with real AUSD only where the region endpoint allows it.
 */
export async function stakesAllowed(): Promise<boolean> {
  if (env.stakeTokenIsMock) return true;
  try {
    const res = await fetch("/api/region", { cache: "no-store" });
    const body = (await res.json()) as { stakesAllowed?: boolean };
    return body.stakesAllowed === true;
  } catch {
    return false;
  }
}
