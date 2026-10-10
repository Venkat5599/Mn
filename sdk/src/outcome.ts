/** Mirrors `enum Outcome` in contracts/src/interfaces/IPitchOracle.sol. Order is ABI: never reorder. */
export const Outcome = {
  NONE: 0,
  BALL: 1,
  STRIKE: 2,
  FOUL: 3,
  IN_PLAY: 4,
  VOID: 5,
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

/** The four outcomes a player can pick. */
export const PICKABLE = [Outcome.BALL, Outcome.STRIKE, Outcome.FOUL, Outcome.IN_PLAY] as const;
export type Pick = (typeof PICKABLE)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  [Outcome.NONE]: "Pending",
  [Outcome.BALL]: "Ball",
  [Outcome.STRIKE]: "Strike",
  [Outcome.FOUL]: "Foul",
  [Outcome.IN_PLAY]: "In play",
  [Outcome.VOID]: "Void",
};

export function isOutcome(n: number): n is Outcome {
  return Number.isInteger(n) && n >= Outcome.NONE && n <= Outcome.VOID;
}

export function isPick(n: number): n is Pick {
  return n >= Outcome.BALL && n <= Outcome.IN_PLAY;
}
