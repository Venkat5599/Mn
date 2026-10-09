"use client";

import { RoomMode, snapshot } from "@pitchside/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePoll } from "@/hooks/use-poll";
import { describeAccountError, unlock } from "@/lib/accounts";
import { createRoom } from "@/lib/actions";
import { authVerb, env, isConfigured } from "@/lib/env";
import { fetchFeed } from "@/lib/mlb";
import { stakesAllowed } from "@/lib/region";
import { Scoreboard } from "../scoreboard/Scoreboard";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import styles from "./CreateRoom.module.css";

const MODES = [
  { mode: RoomMode.POINTS, title: "Points", body: "Free chips, season table, nothing to buy. Works everywhere." },
  { mode: RoomMode.STAKES, title: "Stakes", body: "Everyone buys in with AUSD. 4% of each pot goes to Pitchside." },
] as const;

export function CreateRoom() {
  const router = useRouter();
  const gamePk = Number(useSearchParams().get("game"));
  const valid = Number.isInteger(gamePk) && gamePk > 0;
  const [mode, setMode] = useState<RoomMode>(RoomMode.POINTS);
  const [stakesOk, setStakesOk] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void stakesAllowed().then(setStakesOk);
  }, []);

  const { data: snap } = usePoll(
    async (signal) => (valid ? snapshot(await fetchFeed(gamePk, signal)) : undefined),
    15_000,
    [gamePk],
  );

  const create = async () => {
    setError(undefined);
    setBusy(env.accountMode === "device" ? "Unlocking" : "Waiting for Face ID");
    try {
      // the host's room is created from their main account (index 0)
      const keys = await unlock(0n);
      setBusy("Opening the room on Monad");
      const roomId = await createRoom(keys.main, mode, gamePk);
      keys.endMain();
      router.push(`/r/${roomId}`);
    } catch (err) {
      setError(describeAccountError(err));
      setBusy(undefined);
    }
  };

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Wordmark />
      </nav>

      {!valid ? (
        <p className={styles.note}>Pick a game from the schedule first.</p>
      ) : (
        <>
          {snap ? <Scoreboard snap={snap} /> : <div className={styles.skeleton} />}
          <h1 className={styles.title}>Open a room</h1>

          <div className={styles.modes} role="radiogroup" aria-label="Room type">
            {MODES.map((m) => {
              const locked = m.mode === RoomMode.STAKES && !stakesOk;
              return (
                <button
                  key={m.mode}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.mode}
                  disabled={locked}
                  className={styles.mode}
                  onClick={() => setMode(m.mode)}
                >
                  <span className={styles.modeTitle}>{m.title}</span>
                  <span className={styles.modeBody}>
                    {locked ? "Not available in your region. Points rooms work the same way." : m.body}
                  </span>
                </button>
              );
            })}
          </div>

          {!isConfigured && <p className={styles.note}>Contract addresses are not configured for this build.</p>}
          <Button wide busy={Boolean(busy)} disabled={!isConfigured} onClick={create}>
            {busy ?? `Create room${authVerb}`}
          </Button>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <p className={styles.fine}>
            You get a link to send. Anyone with it can join on their own phone, up to 32 players.
          </p>
        </>
      )}
    </main>
  );
}
