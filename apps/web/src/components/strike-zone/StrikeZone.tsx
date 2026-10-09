"use client";

import { Outcome } from "@pitchside/shared";
import { motion, useReducedMotion } from "motion/react";
import styles from "./StrikeZone.module.css";

export interface ZonePitch {
  seq: number;
  /** pitch number within the current at-bat */
  n: number;
  outcome: Outcome;
  /** feet from the middle of the plate (catcher's view), and height above ground */
  pX: number;
  pZ: number;
}

interface Props {
  pitches: ZonePitch[];
  /** batter's zone in feet; defaults to a typical 1.6 to 3.4 */
  zoneTop?: number;
  zoneBottom?: number;
  /** 0..1 share of the betting window left; undefined hides the timer */
  remaining?: number;
  /** tone of the timer line */
  state?: "open" | "locked" | "idle";
  label?: string;
}

// Real geometry (the plate is 17 inches wide), framed on the band where pitches actually cross:
// 0.85 to 4.15 ft high, about ±1.8 ft wide. Wilder pitches pin to the edge.
const S = 80;
const CX = 150;
const TOP_FT = 4.15;
const BOTTOM_FT = 0.85;
const Y0 = 14;
const H = Y0 + (TOP_FT - BOTTOM_FT) * S + 40;
const PLATE_HALF_FT = 17 / 12 / 2;
const BALL_R = 10.5; // a baseball is ~0.12 ft in radius at this scale, enlarged a touch to fit a number

const px = (ft: number) => CX + ft * S;
const py = (ft: number) => Y0 + (TOP_FT - ft) * S;

export const OUTCOME_VAR: Record<number, string> = {
  [Outcome.BALL]: "var(--o-ball)",
  [Outcome.STRIKE]: "var(--o-strike)",
  [Outcome.FOUL]: "var(--o-foul)",
  [Outcome.IN_PLAY]: "var(--o-inplay)",
  [Outcome.VOID]: "var(--chalk-4)",
};

/** Rounded rectangle as one path starting at top-centre, clockwise, so a dash can burn it down. */
function framePath(x0: number, y0: number, x1: number, y1: number, r: number) {
  const cx = (x0 + x1) / 2;
  return [
    `M ${cx} ${y0}`,
    `H ${x1 - r}`,
    `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V ${y1 - r}`,
    `A ${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H ${x0 + r}`,
    `A ${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `V ${y0 + r}`,
    `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    `Z`,
  ].join(" ");
}

export function StrikeZone({ pitches, zoneTop = 3.4, zoneBottom = 1.6, remaining, state = "idle", label }: Props) {
  const reduce = useReducedMotion();
  const zx0 = px(-PLATE_HALF_FT);
  const zx1 = px(PLATE_HALF_FT);
  const zy0 = py(zoneTop);
  const zy1 = py(zoneBottom);
  const w = (zx1 - zx0) / 3;
  const h = (zy1 - zy0) / 3;
  const pad = 12;
  const frame = framePath(zx0 - pad, zy0 - pad, zx1 + pad, zy1 + pad, 12);
  const latest = pitches[pitches.length - 1];

  // Home plate, seen from the mound and foreshortened: flat front edge, point toward the catcher.
  const plateY = py(BOTTOM_FT) + 6;
  const plate = [
    [px(-PLATE_HALF_FT), plateY],
    [px(PLATE_HALF_FT), plateY],
    [px(PLATE_HALF_FT), plateY + 7],
    [CX, plateY + 15],
    [px(-PLATE_HALF_FT), plateY + 7],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return (
    <figure className={styles.wrap} data-state={state}>
      <svg viewBox={`0 0 300 ${H}`} className={styles.svg} role="img" aria-label={label ?? "Strike zone"}>
        <defs>
          {/* chalk is never a perfect line */}
          <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="4" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="1.1" />
          </filter>
        </defs>

        <g filter="url(#chalk)" className={styles.chalk}>
          <polygon points={plate} className={styles.plate} />
          <rect x={zx0} y={zy0} width={zx1 - zx0} height={zy1 - zy0} className={styles.zone} />
          {[1, 2].map((i) => (
            <line key={`v${i}`} x1={zx0 + w * i} y1={zy0} x2={zx0 + w * i} y2={zy1} className={styles.grid} />
          ))}
          {[1, 2].map((i) => (
            <line key={`h${i}`} x1={zx0} y1={zy0 + h * i} x2={zx1} y2={zy0 + h * i} className={styles.grid} />
          ))}
        </g>

        {/* the betting window: the frame burns down clockwise from the top */}
        <path d={frame} className={styles.frameTrack} pathLength={100} />
        {remaining !== undefined && (
          <path
            d={frame}
            pathLength={100}
            className={styles.frameTimer}
            strokeDasharray={`${Math.max(0, Math.min(1, remaining)) * 100} 100`}
          />
        )}

        {pitches.map((p) => {
          const isLatest = p.seq === latest?.seq;
          const cx = Math.max(BALL_R, Math.min(300 - BALL_R, px(p.pX)));
          const cy = Math.max(BALL_R + 2, Math.min(py(BOTTOM_FT), py(p.pZ)));
          return (
            <motion.g
              key={p.seq}
              style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}
              initial={isLatest && !reduce ? { scale: 1.9 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
              className={isLatest ? styles.latest : styles.older}
            >
              <circle cx={cx} cy={cy} r={BALL_R} fill={OUTCOME_VAR[p.outcome] ?? "var(--chalk-3)"} />
              <text x={cx} y={cy} className={styles.n} textAnchor="middle" dominantBaseline="central">
                {p.n}
              </text>
            </motion.g>
          );
        })}
      </svg>
      {label && <figcaption className={styles.caption}>{label}</figcaption>}
    </figure>
  );
}
