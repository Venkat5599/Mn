"use client";

import { OUTCOME_LABEL, Outcome, PICKABLE, impliedMultiple, type Pick } from "@pitchside/sdk";
import styles from "./OutcomePads.module.css";

const TONE: Record<Pick, string> = {
  [Outcome.BALL]: "ball",
  [Outcome.STRIKE]: "strike",
  [Outcome.FOUL]: "foul",
  [Outcome.IN_PLAY]: "inplay",
};

interface Props {
  pot: bigint[];
  picked?: Pick;
  pending?: Pick;
  disabled: boolean;
  format: (v: bigint) => string;
  onPick: (o: Pick) => void;
}

/** Four calls. Tapping one places (or replaces) your bet at once: the window is seconds long. */
export function OutcomePads({ pot, picked, pending, disabled, format, onPick }: Props) {
  // with calls on one side only the pot refunds, so a multiple would be a lie
  const contested = PICKABLE.filter((o) => (pot[o] ?? 0n) > 0n).length >= 2;
  return (
    <div className={styles.pads} role="group" aria-label="Call the next pitch">
      {PICKABLE.map((o) => {
        const side = pot[o] ?? 0n;
        const mult = contested ? impliedMultiple(pot, o) : null;
        const state = pending === o ? "pending" : picked === o ? "picked" : undefined;
        return (
          <button
            key={o}
            type="button"
            className={styles.pad}
            data-tone={TONE[o]}
            data-state={state}
            disabled={disabled}
            aria-pressed={picked === o}
            onClick={() => onPick(o)}
          >
            <span className={styles.word}>{OUTCOME_LABEL[o]}</span>
            <span className={`${styles.meta} num`}>
              <span>{side > 0n ? format(side) : "no calls"}</span>
              <span className={styles.mult}>{mult ? `${mult.toFixed(mult >= 10 ? 0 : 1)}x` : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
