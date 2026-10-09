/**
 * Picks the longest at-bat (with plate locations) from the recorded game and writes it for the
 * home page's strike-zone replay. Real pitches, nothing invented.
 *   bun scripts/extract-demo-at-bat.ts
 */
import { flattenPitches, type MlbFeed } from "../packages/shared/src";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const feed = (await Bun.file(join(root, "fixtures/mlb/feed-849834-final.json")).json()) as MlbFeed;
const pitches = flattenPitches(feed).filter((p) => p.pX !== undefined && p.pZ !== undefined);

const byAtBat = new Map<number, typeof pitches>();
for (const p of pitches) byAtBat.set(p.atBatIndex, [...(byAtBat.get(p.atBatIndex) ?? []), p]);
const [, best] = [...byAtBat].sort((a, b) => b[1].length - a[1].length)[0]!;

const out = {
  source: `MLB gamePk ${feed.gamePk}, ${feed.gameData.teams.away.abbreviation} @ ${feed.gameData.teams.home.abbreviation}, ${feed.gameData.datetime?.officialDate}`,
  batter: best[0]!.batter,
  pitcher: best[0]!.pitcher,
  inning: best[0]!.inning,
  half: best[0]!.half,
  zoneTop: best[0]!.zoneTop,
  zoneBottom: best[0]!.zoneBottom,
  pitches: best.map((p, i) => ({
    seq: p.seq,
    n: i + 1,
    outcome: p.outcome,
    call: p.callDescription,
    pX: Number(p.pX!.toFixed(3)),
    pZ: Number(p.pZ!.toFixed(3)),
    mph: p.speedMph,
    type: p.pitchType,
    balls: p.balls,
    strikes: p.strikes,
  })),
};
await Bun.write(join(root, "apps/web/src/lib/demo-at-bat.json"), JSON.stringify(out, null, 2));
console.log(`${out.batter} vs ${out.pitcher}: ${out.pitches.length} pitches`, out.pitches.map((p) => p.call).join(", "));
