"use client";

import { POINTS_PER_GAME, RoomMode, STAKES_BUY_INS, STAKE_DECIMALS } from "@pitchside/sdk";
import { useState } from "react";
import { parseUnits } from "viem";
import { authVerb } from "@/lib/env";
import { Button } from "../ui/Button";
import styles from "./JoinPanel.module.css";

interface Props {
  mode: RoomMode;
  players: number;
  busy: boolean;
  step?: string;
  error?: string;
  onJoin: (buyIn: bigint) => void;
}

export function JoinPanel({ mode, players, busy, step, error, onJoin }: Props) {
  const [buyIn, setBuyIn] = useState<(typeof STAKES_BUY_INS)[number]>(10);
  const stakes = mode === RoomMode.STAKES;

  return (
    <section className={styles.panel} aria-labelledby="join-title">
      <h2 id="join-title" className={styles.title}>
        {stakes ? "Buy in and call the next pitch" : `Take ${POINTS_PER_GAME.toLocaleString()} chips and call the next pitch`}
      </h2>
      <p className={styles.body}>
        {players === 0 ? "You're first in." : `${players} ${players === 1 ? "friend is" : "friends are"} already in.`}{" "}
        {stakes
          ? "Your buy-in sits in a key made just for this room. One unlock, then every call is one tap."
          : "Points are free and only count for this room's season table. One unlock, then every call is one tap."}
      </p>

      {stakes && (
        <div className={styles.buyins} role="radiogroup" aria-label="Buy-in">
          {STAKES_BUY_INS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={buyIn === v}
              className={styles.buyin}
              onClick={() => setBuyIn(v)}
            >
              <span className="num">${v}</span>
            </button>
          ))}
        </div>
      )}

      <Button
        wide
        busy={busy}
        onClick={() => onJoin(stakes ? parseUnits(String(buyIn), STAKE_DECIMALS) : 0n)}
      >
        {busy ? (step ?? "Joining") : `Join${authVerb}`}
      </Button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
