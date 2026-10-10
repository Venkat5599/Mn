"use client";

import Link from "next/link";
import { usePoll } from "@/hooks/use-poll";
import { fetchUpcomingGames, type ScheduledGame } from "@/lib/mlb";
import styles from "./GameBoard.module.css";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

function Row({ g }: { g: ScheduledGame }) {
  const live = g.state === "Live";
  const final = g.state === "Final";
  return (
    <li className={styles.row} data-live={live || undefined}>
      <div className={styles.teams}>
        <span className={styles.abbr}>{g.away.abbr}</span>
        {g.away.runs !== undefined && <span className={`${styles.runs} num`}>{g.away.runs}</span>}
        <span className={styles.at}>at</span>
        <span className={styles.abbr}>{g.home.abbr}</span>
        {g.home.runs !== undefined && <span className={`${styles.runs} num`}>{g.home.runs}</span>}
      </div>
      <div className={styles.meta}>
        <span className={styles.series}>{g.series ?? `${g.away.name} at ${g.home.name}`}</span>
        <span className={`${styles.when} num`}>{live ? (g.inning ?? "Live") : final ? "Final" : time(g.startsAt)}</span>
      </div>
      {final ? (
        <span className={styles.closed}>Closed</span>
      ) : (
        <Link className={styles.open} href={`/new?game=${g.gamePk}`}>
          Open a room
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M3 9 9 3M4.2 3H9v4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </li>
  );
}

export function GameBoard() {
  const { data, error } = usePoll((signal) => fetchUpcomingGames(signal), 30_000, []);

  return (
    <div className={styles.board}>
      <h2 className={styles.date}>{data ? day(data.date) : "Today"}</h2>
      {error && !data && <p className={styles.empty}>Can't reach the MLB schedule right now. Retrying.</p>}
      {!data && !error && (
        <ul className={styles.list} aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className={`${styles.row} ${styles.skeleton}`} />
          ))}
        </ul>
      )}
      {data && data.games.length === 0 && (
        <p className={styles.empty}>No MLB games in the next few days. Rooms open when the next game is scheduled.</p>
      )}
      {data && data.games.length > 0 && (
        <ul className={styles.list}>
          {data.games.map((g) => (
            <Row key={g.gamePk} g={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
