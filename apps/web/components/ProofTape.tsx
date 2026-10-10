"use client";

import { challengeValid, maxChallenges, type ChallengeRecord, type Sla } from "@hyperhedge/sdk";
import { useMemo } from "react";
import { short } from "@/lib/format";
import s from "./ProofTape.module.css";

/**
 * The delivery tape: one cell per challenge slot in the window. A proven cell carries the first bytes of
 * the host's proof; a missed cell stays hollow; a slot not yet reached is a faint tick. Every cell is
 * re-verified here in the browser, not taken from the oracle's word.
 */
export function ProofTape({
  id,
  sla,
  windowStart,
  windowEnd,
  challenges,
  compact = false,
}: {
  id: bigint;
  sla: Sla;
  windowStart: number;
  windowEnd: number;
  challenges: ChallengeRecord[];
  compact?: boolean;
}) {
  const slots = maxChallenges(sla, windowStart, windowEnd);
  const cells = useMemo(
    () =>
      Array.from({ length: slots }, (_, i) => {
        const c = challenges[i];
        if (!c) return { i, kind: "future" as const };
        if (c.nonce === null && c.answeredAt === null && Date.now() < c.dueBy) return { i, kind: "pending" as const, c };
        return { i, kind: challengeValid(c, id, sla.difficultyBits) ? ("proven" as const) : ("missed" as const), c };
      }),
    [slots, challenges, id, sla.difficultyBits],
  );
  const proven = cells.filter((c) => c.kind === "proven").length;
  const missed = cells.filter((c) => c.kind === "missed").length;
  const need = sla.requiredSolves;
  const allowedMisses = slots - need;

  return (
    <figure className={`${s.tape} ${compact ? s.compact : ""}`}>
      <div className={s.cells} style={{ ["--n" as string]: slots }}>
        {cells.map((cell) => (
          <div key={cell.i} className={`${s.cell} ${s[cell.kind]}`} title={title(cell)}>
            {cell.kind === "proven" && !compact ? <span className="mono">{cell.c!.seed.slice(2, 6)}</span> : null}
          </div>
        ))}
        <div className={s.threshold} style={{ left: `${(need / slots) * 100}%` }} aria-hidden="true" />
      </div>
      <figcaption className={s.caption}>
        <span>
          <b className="num">{proven}</b> proven
        </span>
        <span>
          <b className="num">{missed}</b> missed <span className="muted">of {allowedMisses} allowed</span>
        </span>
        <span className="muted">
          needs <span className="num">{need}</span> of <span className="num">{slots}</span> · 2<sup>{sla.difficultyBits}</sup> hashes each
        </span>
      </figcaption>
    </figure>
  );
}

function title(cell: { i: number; kind: string; c?: ChallengeRecord }) {
  if (!cell.c) return `slot ${cell.i + 1}: not reached yet`;
  const base = `slot ${cell.i + 1} · block ${cell.c.blockNumber} · seed ${short(cell.c.seed, 6)}`;
  if (cell.kind === "proven") return `${base}\nproof verified in your browser · answered in ${cell.c.answeredAt! - cell.c.issuedAt} ms`;
  if (cell.kind === "pending") return `${base}\nwaiting for the host`;
  return `${base}\nno valid proof before the deadline`;
}
