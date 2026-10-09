"use client";

import { flattenPitches, snapshot, type FlatPitch, type GameSnapshot } from "@pitchside/shared";
import { fetchFeed } from "@/lib/mlb";
import { usePoll } from "./use-poll";

export interface GameView {
  snap: GameSnapshot;
  pitches: FlatPitch[];
}

/** Live MLB state for the UI. Money state never comes from here, only from the chain. */
export function useGame(gamePk: number | undefined) {
  return usePoll<GameView | undefined>(
    async (signal) => {
      if (!gamePk) return undefined;
      const feed = await fetchFeed(gamePk, signal);
      return { snap: snapshot(feed), pitches: flattenPitches(feed) };
    },
    1_500,
    [gamePk],
  );
}
