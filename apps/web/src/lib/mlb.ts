import { feedUrl, scheduleUrl, type MlbFeed } from "@pitchside/shared";
import { env } from "./env";

export interface ScheduledGame {
  gamePk: number;
  startsAt: string;
  state: "Preview" | "Live" | "Final";
  detailedState: string;
  away: { abbr: string; name: string; runs?: number };
  home: { abbr: string; name: string; runs?: number };
  series?: string;
  inning?: string;
}

interface ScheduleResponse {
  dates: {
    date: string;
    games: {
      gamePk: number;
      gameDate: string;
      status: { abstractGameState: ScheduledGame["state"]; detailedState: string };
      seriesDescription?: string;
      description?: string;
      linescore?: { currentInningOrdinal?: string; inningHalf?: string };
      teams: {
        away: { score?: number; team: { abbreviation: string; teamName: string } };
        home: { score?: number; team: { abbreviation: string; teamName: string } };
      };
    }[];
  }[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchFeed(gamePk: number, signal?: AbortSignal): Promise<MlbFeed> {
  const res = await fetch(feedUrl(gamePk, env.mlbApi), { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`MLB feed ${res.status}`);
  return res.json();
}

/** Today's games, or the next day that has any (looks up to 5 days ahead). */
export async function fetchUpcomingGames(signal?: AbortSignal): Promise<{ date: string; games: ScheduledGame[] }> {
  const day = new Date();
  for (let i = 0; i < 6; i++) {
    const date = isoDay(new Date(day.getTime() + i * 86_400_000));
    const res = await fetch(scheduleUrl(date, env.mlbApi), { signal });
    if (!res.ok) throw new Error(`MLB schedule ${res.status}`);
    const json = (await res.json()) as ScheduleResponse;
    const games = (json.dates[0]?.games ?? []).map(
      (g): ScheduledGame => ({
        gamePk: g.gamePk,
        startsAt: g.gameDate,
        state: g.status.abstractGameState,
        detailedState: g.status.detailedState,
        away: { abbr: g.teams.away.team.abbreviation, name: g.teams.away.team.teamName, runs: g.teams.away.score },
        home: { abbr: g.teams.home.team.abbreviation, name: g.teams.home.team.teamName, runs: g.teams.home.score },
        series: g.description || g.seriesDescription,
        inning: g.linescore?.currentInningOrdinal
          ? `${g.linescore.inningHalf ?? ""} ${g.linescore.currentInningOrdinal}`.trim()
          : undefined,
      }),
    );
    const playable = games.filter((g) => g.state !== "Final");
    if (playable.length) return { date, games };
  }
  return { date: isoDay(day), games: [] };
}
