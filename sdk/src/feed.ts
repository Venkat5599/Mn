import { mapCall } from "./mapping";
import type { Outcome } from "./outcome";

/** The subset of MLB `GET /api/v1.1/game/{gamePk}/feed/live` that Pitchside reads. */
export interface MlbFeed {
  gamePk: number;
  gameData: {
    status: { abstractGameState: string; detailedState: string; codedGameState?: string };
    datetime?: { dateTime?: string; officialDate?: string };
    teams: {
      away: { abbreviation: string; teamName?: string; name: string };
      home: { abbreviation: string; teamName?: string; name: string };
    };
    venue?: { name?: string };
  };
  liveData: {
    plays: {
      allPlays: MlbPlay[];
      currentPlay?: MlbPlay;
    };
    linescore?: {
      currentInning?: number;
      inningHalf?: string;
      isTopInning?: boolean;
      outs?: number;
      balls?: number;
      strikes?: number;
      teams?: { home?: { runs?: number }; away?: { runs?: number } };
    };
  };
}

export interface MlbPlay {
  atBatIndex: number;
  about: { inning: number; halfInning: string; isComplete?: boolean };
  matchup?: {
    batter?: { id: number; fullName: string };
    pitcher?: { id: number; fullName: string };
  };
  count?: { balls: number; strikes: number; outs: number };
  playEvents: MlbPlayEvent[];
}

export interface MlbPlayEvent {
  isPitch: boolean;
  playId?: string;
  pitchNumber?: number;
  startTime?: string;
  endTime?: string;
  details: {
    call?: { code?: string; description?: string };
    description?: string;
    type?: { code?: string; description?: string };
  };
  count?: { balls: number; strikes: number; outs: number };
  pitchData?: {
    startSpeed?: number;
    strikeZoneTop?: number;
    strikeZoneBottom?: number;
    coordinates?: { pX?: number; pZ?: number };
  };
}

/** One pitch, flattened and numbered the way the oracle numbers it. */
export interface FlatPitch {
  /** 1-based count of `isPitch` events in feed order. Pickoffs and mound visits never consume a seq. */
  seq: number;
  playId: string;
  atBatIndex: number;
  inning: number;
  half: "top" | "bottom";
  callCode: string;
  callDescription: string;
  outcome: Outcome;
  /** unix seconds, floored (conservative for the refund-after-start rule) */
  startTs: number;
  endTs: number;
  startMs: number;
  endMs: number;
  /** count after the pitch */
  balls: number;
  strikes: number;
  outs: number;
  speedMph?: number;
  pitchType?: string;
  /** plate location in feet: pX horizontal from the middle of the plate, pZ height */
  pX?: number;
  pZ?: number;
  zoneTop?: number;
  zoneBottom?: number;
  batter?: string;
  pitcher?: string;
}

const toMs = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** Pitches with no usable timestamps are skipped: the oracle cannot run a lock window without them. */
export function flattenPitches(feed: MlbFeed): FlatPitch[] {
  const out: FlatPitch[] = [];
  for (const play of feed.liveData.plays.allPlays) {
    for (const ev of play.playEvents) {
      if (!ev.isPitch) continue;
      const startMs = toMs(ev.startTime);
      const endMs = toMs(ev.endTime ?? ev.startTime);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      const call = ev.details.call ?? {};
      out.push({
        seq: out.length + 1,
        playId: ev.playId ?? `${play.atBatIndex}:${ev.pitchNumber ?? out.length}`,
        atBatIndex: play.atBatIndex,
        inning: play.about.inning,
        half: play.about.halfInning === "top" ? "top" : "bottom",
        callCode: call.code ?? "",
        callDescription: call.description ?? ev.details.description ?? "",
        outcome: mapCall(call.description ?? ev.details.description, call.code),
        startTs: Math.floor(startMs / 1000),
        endTs: Math.floor(Math.max(endMs, startMs) / 1000),
        startMs,
        endMs: Math.max(endMs, startMs),
        balls: ev.count?.balls ?? 0,
        strikes: ev.count?.strikes ?? 0,
        outs: ev.count?.outs ?? 0,
        speedMph: ev.pitchData?.startSpeed,
        pitchType: ev.details.type?.description,
        pX: ev.pitchData?.coordinates?.pX,
        pZ: ev.pitchData?.coordinates?.pZ,
        zoneTop: ev.pitchData?.strikeZoneTop,
        zoneBottom: ev.pitchData?.strikeZoneBottom,
        batter: play.matchup?.batter?.fullName,
        pitcher: play.matchup?.pitcher?.fullName,
      });
    }
  }
  return out;
}

export type GamePhase = "preview" | "live" | "final";

export interface GameSnapshot {
  gamePk: number;
  phase: GamePhase;
  detailedState: string;
  away: string;
  home: string;
  awayRuns: number;
  homeRuns: number;
  inning: number;
  half: "top" | "bottom";
  balls: number;
  strikes: number;
  outs: number;
  batter?: string;
  pitcher?: string;
  venue?: string;
  startsAt?: string;
}

export function gamePhase(feed: MlbFeed): GamePhase {
  const s = feed.gameData.status.abstractGameState;
  if (s === "Final") return "final";
  if (s === "Live") return "live";
  return "preview";
}

export function snapshot(feed: MlbFeed): GameSnapshot {
  const ls = feed.liveData.linescore ?? {};
  const cur = feed.liveData.plays.currentPlay;
  return {
    gamePk: feed.gamePk,
    phase: gamePhase(feed),
    detailedState: feed.gameData.status.detailedState,
    away: feed.gameData.teams.away.abbreviation,
    home: feed.gameData.teams.home.abbreviation,
    awayRuns: ls.teams?.away?.runs ?? 0,
    homeRuns: ls.teams?.home?.runs ?? 0,
    inning: ls.currentInning ?? 1,
    half: ls.isTopInning === false ? "bottom" : "top",
    balls: ls.balls ?? cur?.count?.balls ?? 0,
    strikes: ls.strikes ?? cur?.count?.strikes ?? 0,
    outs: ls.outs ?? cur?.count?.outs ?? 0,
    batter: cur?.matchup?.batter?.fullName,
    pitcher: cur?.matchup?.pitcher?.fullName,
    venue: feed.gameData.venue?.name,
    startsAt: feed.gameData.datetime?.dateTime,
  };
}

/** Position of `playId` in the flattened feed, or -1. CRE uses this to check the relayer's seq claim. */
export function seqOfPlayId(pitches: FlatPitch[], playId: string): number {
  const p = pitches.find((x) => x.playId === playId);
  return p ? p.seq : -1;
}
