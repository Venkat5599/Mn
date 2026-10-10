import { Outcome } from "./outcome";

/**
 * MLB `details.call.description` -> Outcome. This file is the single source of truth:
 * the relayer and the Chainlink CRE workflow both import it, so the two oracle sources can
 * only disagree when the feed itself changes.
 */
const BY_DESCRIPTION: Record<string, Outcome> = {
  // ball
  "Ball": Outcome.BALL,
  "Ball In Dirt": Outcome.BALL,
  "Intent Ball": Outcome.BALL,
  "Pitchout": Outcome.BALL,
  "Hit By Pitch": Outcome.BALL,
  "Automatic Ball": Outcome.BALL,
  // strike
  "Called Strike": Outcome.STRIKE,
  "Swinging Strike": Outcome.STRIKE,
  "Swinging Strike (Blocked)": Outcome.STRIKE,
  "Foul Tip": Outcome.STRIKE,
  "Missed Bunt": Outcome.STRIKE,
  "Automatic Strike": Outcome.STRIKE,
  // foul
  "Foul": Outcome.FOUL,
  "Foul Bunt": Outcome.FOUL,
  "Foul Pitchout": Outcome.FOUL,
  // in play
  "In play, out(s)": Outcome.IN_PLAY,
  "In play, no out": Outcome.IN_PLAY,
  "In play, run(s)": Outcome.IN_PLAY,
};

/** Fallback on the one-letter call code when the description text is new. */
const BY_CODE: Record<string, Outcome> = {
  "B": Outcome.BALL,
  "*B": Outcome.BALL,
  "I": Outcome.BALL,
  "P": Outcome.BALL,
  "H": Outcome.BALL,
  "V": Outcome.BALL,
  "C": Outcome.STRIKE,
  "S": Outcome.STRIKE,
  "W": Outcome.STRIKE,
  "T": Outcome.STRIKE,
  "M": Outcome.STRIKE,
  "A": Outcome.STRIKE,
  "F": Outcome.FOUL,
  "L": Outcome.FOUL,
  "R": Outcome.FOUL,
  "X": Outcome.IN_PLAY,
  "D": Outcome.IN_PLAY,
  "E": Outcome.IN_PLAY,
};

/** Anything unrecognised becomes VOID, which refunds the market. Never guess. */
export function mapCall(description: string | undefined, code?: string): Outcome {
  if (description && description in BY_DESCRIPTION) return BY_DESCRIPTION[description]!;
  if (code && code in BY_CODE) return BY_CODE[code]!;
  return Outcome.VOID;
}
