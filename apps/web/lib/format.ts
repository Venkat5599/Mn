import { hexToString, type Hex } from "viem";

const USD = 1_000_000n;

/** hhUSD has 6 decimals. Shows cents only when they exist. */
export function usd(v: bigint): string {
  const whole = v / USD;
  const cents = Number((v % USD) / 10_000n);
  const w = whole.toLocaleString("en-US");
  return cents ? `${w}.${cents.toString().padStart(2, "0")}` : w;
}

export const short = (h: string, n = 4) => `${h.slice(0, 2 + n)}…${h.slice(-n)}`;

export function bytes32Label(h: Hex): string {
  try {
    return hexToString(h, { size: 32 }).replace(/\0+$/, "");
  } catch {
    return short(h);
  }
}

export function when(ts: number | bigint): string {
  return new Date(Number(ts) * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function relative(ts: number | bigint, now = Date.now() / 1000): string {
  const d = Number(ts) - now;
  const a = Math.abs(d);
  const s = a < 60 ? `${Math.round(a)}s` : a < 3600 ? `${Math.round(a / 60)}m` : a < 86_400 ? `${(a / 3600).toFixed(1)}h` : `${(a / 86_400).toFixed(1)}d`;
  return d >= 0 ? `in ${s}` : `${s} ago`;
}

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
