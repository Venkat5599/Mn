/** Seconds after a pitch ends that the next market accepts bets. Must equal the deployed oracle's lockDelay(). */
export const LOCK_DELAY_SECONDS = 8;

/** Mirrors PitchsideRooms constants. */
export const MAX_PLAYERS = 32;
export const POINTS_PER_GAME = 1_000n;
export const STAKES_RAKE_BPS = 400;
export const MAX_BET_BPS = 2_500;
export const STALE_AFTER_SECONDS = 3_600;

export const RoomMode = { POINTS: 0, STAKES: 1 } as const;
export type RoomMode = (typeof RoomMode)[keyof typeof RoomMode];

/** AUSD and the testnet mock both use 6 decimals. */
export const STAKE_DECIMALS = 6;
export const STAKES_BUY_INS = [5, 10, 20] as const;

export const MLB_API = "https://statsapi.mlb.com/api";
export const feedUrl = (gamePk: number, base: string = MLB_API) => `${base}/v1.1/game/${gamePk}/feed/live`;
/**
 * Same feed, filtered to the fields `flattenPitches` reads (~95KB instead of ~790KB for a full game).
 * The CRE workflow uses this so each DON node's HTTP response stays small.
 */
const CONFIRM_FIELDS = [
  "gamePk", "gameData", "status", "abstractGameState", "detailedState", "teams", "away", "home",
  "abbreviation", "name", "liveData", "plays", "allPlays", "atBatIndex", "about", "inning", "halfInning",
  "playEvents", "isPitch", "playId", "pitchNumber", "startTime", "endTime", "details", "call", "code",
  "description",
].join(",");
export const confirmFeedUrl = (gamePk: number) => `${feedUrl(gamePk)}?fields=${CONFIRM_FIELDS}`;

export const scheduleUrl = (date: string, base: string = MLB_API) =>
  `${base}/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore`;

/** Max bet allowed for a stack, same integer math as PitchsideRooms.maxBetFor. */
export function maxBetFor(stack: bigint): bigint {
  const max = (stack * BigInt(MAX_BET_BPS)) / 10_000n;
  return max === 0n && stack !== 0n ? 1n : max;
}
