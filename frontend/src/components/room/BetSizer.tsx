"use client";

import { maxBetFor } from "@pitchside/sdk";
import styles from "./BetSizer.module.css";

export const SIZES = [
  { key: "small", label: "Small", share: 40n }, // 1/40 of stack
  { key: "medium", label: "Medium", share: 10n },
  { key: "max", label: "Max", share: 4n },
] as const;
export type SizeKey = (typeof SIZES)[number]["key"];

export function amountFor(stack: bigint, key: SizeKey): bigint {
  const max = maxBetFor(stack);
  const s = SIZES.find((x) => x.key === key)!;
  const v = stack / s.share;
  if (max === 0n) return 0n;
  return v < 1n ? 1n : v > max ? max : v;
}

export function BetSizer({
  stack,
  value,
  onChange,
  format,
}: {
  stack: bigint;
  value: SizeKey;
  onChange: (k: SizeKey) => void;
  format: (v: bigint) => string;
}) {
  return (
    <div className={styles.sizer} role="radiogroup" aria-label="Bet size">
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          role="radio"
          aria-checked={value === s.key}
          className={styles.size}
          onClick={() => onChange(s.key)}
        >
          <span>{s.label}</span>
          <span className="num">{format(amountFor(stack, s.key))}</span>
        </button>
      ))}
    </div>
  );
}
