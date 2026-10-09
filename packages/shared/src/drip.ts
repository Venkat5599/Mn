import { getAddress, type Address } from "viem";

/** UTC day, the drip rate-limit window. */
export const dripDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Exact text the main account signs to ask the relayer for gas. App and relayer both use this. */
export function dripMessage(target: Address, day: string = dripDay()) {
  return `Pitchside gas drip\naddress: ${getAddress(target)}\nday: ${day}`;
}
