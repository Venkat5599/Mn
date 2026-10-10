import { Outcome, PICKABLE } from "./outcome";

/**
 * What a bet pays, using the same integer math as PitchsideRooms.settle.
 * `pot` is indexed by Outcome (potOf). Ignores late-bet refunds, which only the chain can know.
 */
export function projectPayout(
  pot: readonly bigint[],
  picked: Outcome,
  result: Outcome,
  amount: bigint,
  rakeBps: number,
): { payout: bigint; refunded: boolean } {
  const total = PICKABLE.reduce((s, o) => s + (pot[o] ?? 0n), 0n);
  const winning = pot[result] ?? 0n;
  const used = PICKABLE.filter((o) => (pot[o] ?? 0n) > 0n).length;
  if (result === Outcome.VOID || result === Outcome.NONE || winning === 0n || used < 2) {
    return { payout: amount, refunded: true };
  }
  if (picked !== result) return { payout: 0n, refunded: false };
  const distributable = total - (total * BigInt(rakeBps)) / 10_000n;
  return { payout: (amount * distributable) / winning, refunded: false };
}

/** Payout multiple for one more unit on `o`, before rake. Infinity-free: empty side shows null. */
export function impliedMultiple(pot: readonly bigint[], o: Outcome): number | null {
  const total = PICKABLE.reduce((s, x) => s + (pot[x] ?? 0n), 0n);
  const side = pot[o] ?? 0n;
  if (side === 0n || total === 0n) return null;
  return Number((total * 100n) / side) / 100;
}
