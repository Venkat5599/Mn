"use client";

export const SETTINGS_KEY = "hyperhedge.settings";

export interface Prefs {
  /** extra premium tolerance on price-protection buys, percent */
  slippagePct: number;
  /** multiplies every polling interval: 0.5 = twice as fast, 2 = half as often */
  refreshFactor: number;
  /** price protection defaults */
  dropPct: number;
  durationIdx: 0 | 1 | 2;
  /** markets list default filter */
  marketsFilter: "all" | "live" | "review" | "done";
}

export const DEFAULT_PREFS: Prefs = { slippagePct: 2, refreshFactor: 1, dropPct: 5, durationIdx: 0, marketsFilter: "all" };

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false; // storage blocked (private window): applies to this visit only
  }
}
