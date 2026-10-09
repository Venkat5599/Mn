import { feedUrl, type MlbFeed } from "@pitchside/shared";

export interface FeedSource {
  read(): Promise<MlbFeed>;
}

/** Live MLB Stats API. No key needed. Non-commercial terms: fine for the demo, production licenses a feed. */
export class HttpFeedSource implements FeedSource {
  constructor(
    private readonly gamePk: number,
    private readonly timeoutMs = 4_000,
  ) {}

  async read(): Promise<MlbFeed> {
    const res = await fetch(feedUrl(this.gamePk), {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`MLB feed ${this.gamePk}: HTTP ${res.status}`);
    return (await res.json()) as MlbFeed;
  }
}

/**
 * Replays a recorded feed. `cutoffMs` decides how much of the game exists "now":
 * only pitches whose endTime is at or before the cutoff are visible, like the live feed.
 */
export class RecordedFeedSource implements FeedSource {
  public cutoffMs = 0;

  constructor(private readonly full: MlbFeed) {}

  async read(): Promise<MlbFeed> {
    const cutoff = this.cutoffMs;
    const allPlays = this.full.liveData.plays.allPlays
      .map((play) => ({
        ...play,
        playEvents: play.playEvents.filter((e) => {
          const end = Date.parse(e.endTime ?? e.startTime ?? "");
          return Number.isFinite(end) && end <= cutoff;
        }),
      }))
      .filter((play) => play.playEvents.length > 0);
    const lastEnd = this.lastEndMs();
    return {
      ...this.full,
      gameData: {
        ...this.full.gameData,
        status:
          cutoff >= lastEnd
            ? this.full.gameData.status
            : { abstractGameState: "Live", detailedState: "In Progress", codedGameState: "I" },
      },
      liveData: { ...this.full.liveData, plays: { allPlays } },
    };
  }

  lastEndMs(): number {
    let max = 0;
    for (const p of this.full.liveData.plays.allPlays)
      for (const e of p.playEvents) max = Math.max(max, Date.parse(e.endTime ?? e.startTime ?? "") || 0);
    return max;
  }
}
