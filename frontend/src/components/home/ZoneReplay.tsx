"use client";

import { OUTCOME_LABEL, type Outcome } from "@pitchside/sdk";
import { useEffect, useState } from "react";
import atBat from "@/lib/demo-at-bat.json";
import { StrikeZone, type ZonePitch } from "../strike-zone/StrikeZone";
import styles from "./ZoneReplay.module.css";

const STEP_MS = 1_900;
const HOLD_MS = 3_600;

/** Replays a real recorded at-bat: every pitch is one market, the frame is its betting window. */
export function ZoneReplay() {
  const all = atBat.pitches as (ZonePitch & { call: string; balls: number; strikes: number; mph?: number; type?: string })[];
  const [shown, setShown] = useState(all.length); // first paint shows the full at-bat
  const [started, setStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const wait = shown >= all.length ? HOLD_MS : STEP_MS;
    const t = setTimeout(() => {
      setShown((s) => (s >= all.length ? 1 : s + 1));
      setStarted(Date.now());
    }, wait);
    return () => clearTimeout(t);
  }, [shown, all.length]);

  const last = all[shown - 1]!;
  // the feed stores the count AFTER a pitch; a broadcast shows the count it was thrown in
  const before = shown > 1 ? all[shown - 2]! : { balls: 0, strikes: 0 };
  const done = shown >= all.length;
  const remaining = done ? undefined : Math.max(0, 1 - (now - started) / STEP_MS);

  return (
    <div className={styles.replay}>
      <StrikeZone
        pitches={all.slice(0, shown)}
        zoneTop={atBat.zoneTop}
        zoneBottom={atBat.zoneBottom}
        remaining={remaining}
        state={done ? "idle" : "open"}
      />
      <p className={styles.call}>
        <span className={styles.callWord} style={{ color: `var(--o-${["", "ball", "strike", "foul", "inplay"][last.outcome]})` }}>
          {OUTCOME_LABEL[last.outcome as Outcome]}
        </span>
        <span className="num">
          {before.balls}-{before.strikes}
          {last.mph ? ` · ${Math.round(last.mph)} mph ${last.type?.toLowerCase() ?? ""}` : ""}
        </span>
      </p>
      <p className={styles.source}>
        {atBat.batter} vs {atBat.pitcher}. A real {all.length}-pitch at-bat: {all.length} markets.
      </p>
    </div>
  );
}
