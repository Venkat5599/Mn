import { RoomMode, STAKE_DECIMALS } from "@pitchside/shared";
import { formatUnits } from "viem";

const int = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** Points are whole chips; Stakes are AUSD with 6 decimals. */
export function chipFormatter(mode: RoomMode) {
  return mode === RoomMode.STAKES
    ? (v: bigint) => usd.format(Number(formatUnits(v, STAKE_DECIMALS)))
    : (v: bigint) => int.format(v);
}

export const signed = (v: bigint, fmt: (x: bigint) => string) => (v >= 0n ? `+${fmt(v)}` : `−${fmt(-v)}`);
