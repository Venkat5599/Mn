import type { GameSnapshot } from "@pitchside/shared";
import styles from "./Scoreboard.module.css";

function Lights({ label, lit, of, tone }: { label: string; lit: number; of: number; tone: string }) {
  return (
    <div className={styles.lights} aria-label={`${label} ${lit}`}>
      <span className={styles.lightLabel}>{label[0]}</span>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={styles.light} data-on={i < lit || undefined} style={{ ["--tone" as string]: tone }} />
      ))}
    </div>
  );
}

/** The ballpark scoreboard: line score, inning, and the count lights. */
export function Scoreboard({ snap }: { snap: GameSnapshot }) {
  const live = snap.phase === "live";
  return (
    <header className={styles.board}>
      <div className={styles.team}>
        <span className={styles.abbr}>{snap.away}</span>
        <span className={`${styles.runs} num`}>{snap.awayRuns}</span>
      </div>
      <div className={styles.middle}>
        {live ? (
          <>
            <span className={styles.inning}>
              <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true" className={snap.half === "bottom" ? styles.down : ""}>
                <path d="M5 0.6 9.4 7.4H0.6z" fill="currentColor" />
              </svg>
              <span className="num">{snap.inning}</span>
            </span>
            <div className={styles.count}>
              <Lights label="Balls" lit={Math.min(snap.balls, 3)} of={3} tone="var(--grass)" />
              <Lights label="Strikes" lit={Math.min(snap.strikes, 2)} of={2} tone="var(--sodium)" />
              <Lights label="Outs" lit={Math.min(snap.outs, 2)} of={2} tone="var(--clay)" />
            </div>
          </>
        ) : (
          <span className={styles.state}>{snap.detailedState}</span>
        )}
      </div>
      <div className={`${styles.team} ${styles.home}`}>
        <span className={`${styles.runs} num`}>{snap.homeRuns}</span>
        <span className={styles.abbr}>{snap.home}</span>
      </div>
    </header>
  );
}
