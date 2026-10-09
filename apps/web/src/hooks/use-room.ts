"use client";

import { Outcome, pitchOracleAbi, pitchsideRoomsAbi, type RoomMode } from "@pitchside/shared";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain";
import { env } from "@/lib/env";
import { usePoll } from "./use-poll";

export interface Standing {
  address: Address;
  chips: bigint;
}

export interface LastMarket {
  seq: number;
  outcome: Outcome;
  settled: boolean;
  pot: bigint[];
  myBet?: { amount: bigint; outcome: Outcome };
}

export interface RoomView {
  roomId: bigint;
  host: Address;
  mode: RoomMode;
  rakeBps: number;
  gamePk: number;
  players: number;
  /** oracle state */
  gameOpen: boolean;
  gameClosed: boolean;
  lastSeq: number;
  /** the market accepting bets right now (lastSeq + 1) */
  openSeq: number;
  lockAt: number;
  pot: bigint[];
  myBet?: { amount: bigint; outcome: Outcome };
  myChips: bigint;
  isPlayer: boolean;
  standings: Standing[];
  last?: LastMarket;
}

const rooms = { address: env.rooms, abi: pitchsideRoomsAbi } as const;
const oracle = { address: env.oracle, abi: pitchOracleAbi } as const;

const bet = (b: { amount: bigint; outcome: number }) =>
  b.amount > 0n ? { amount: b.amount, outcome: b.outcome as Outcome } : undefined;

async function load(roomId: bigint, me: Address | undefined): Promise<RoomView> {
  const [host, mode, rakeBps, gamePk, players] = await publicClient.readContract({
    ...rooms,
    functionName: "rooms",
    args: [roomId],
  });
  if (host === "0x0000000000000000000000000000000000000000") throw new Error("Room not found");

  const [game, members] = await Promise.all([
    publicClient.readContract({ ...oracle, functionName: "game", args: [gamePk] }),
    publicClient.readContract({ ...rooms, functionName: "members", args: [roomId] }),
  ]);
  const openSeq = game.lastSeq + 1;
  const prevSeq = game.lastSeq;

  const [lockAt, pot, chips, prev] = await Promise.all([
    publicClient.readContract({ ...oracle, functionName: "marketLockAt", args: [gamePk, openSeq] }),
    publicClient.readContract({ ...rooms, functionName: "potOf", args: [roomId, gamePk, openSeq] }),
    Promise.all(members.map((m) => publicClient.readContract({ ...rooms, functionName: "chips", args: [roomId, m] }))),
    prevSeq > 0
      ? Promise.all([
          publicClient.readContract({ ...oracle, functionName: "pitch", args: [gamePk, prevSeq] }),
          publicClient.readContract({ ...rooms, functionName: "settled", args: [roomId, gamePk, prevSeq] }),
          publicClient.readContract({ ...rooms, functionName: "potOf", args: [roomId, gamePk, prevSeq] }),
        ])
      : undefined,
  ]);

  let myBet: RoomView["myBet"];
  let myPrevBet: RoomView["myBet"];
  if (me) {
    const [b, pb] = await Promise.all([
      publicClient.readContract({ ...rooms, functionName: "betOf", args: [roomId, gamePk, openSeq, me] }),
      prevSeq > 0
        ? publicClient.readContract({ ...rooms, functionName: "betOf", args: [roomId, gamePk, prevSeq, me] })
        : undefined,
    ]);
    myBet = bet(b);
    myPrevBet = pb ? bet(pb) : undefined;
  }

  const meLower = me?.toLowerCase();
  const standings = members
    .map((address, i) => ({ address, chips: chips[i] ?? 0n }))
    .sort((a, b) => (b.chips > a.chips ? 1 : b.chips < a.chips ? -1 : 0));
  const meIdx = members.findIndex((m) => m.toLowerCase() === meLower);

  return {
    roomId,
    host,
    mode: mode as RoomMode,
    rakeBps,
    gamePk,
    players,
    gameOpen: game.open,
    gameClosed: game.closed,
    lastSeq: game.lastSeq,
    openSeq,
    lockAt: Number(lockAt),
    pot: [...pot],
    myBet,
    myChips: meIdx >= 0 ? (chips[meIdx] ?? 0n) : 0n,
    isPlayer: meIdx >= 0,
    standings,
    last: prev
      ? {
          seq: prevSeq,
          outcome: (prev[0].confirmed !== Outcome.NONE ? prev[0].confirmed : prev[0].fast) as Outcome,
          settled: prev[1],
          pot: [...prev[2]],
          myBet: myPrevBet,
        }
      : undefined,
  };
}

export function useRoom(roomId: bigint | undefined, me: Address | undefined) {
  return usePoll<RoomView | undefined>(
    async () => (roomId === undefined ? undefined : load(roomId, me)),
    1_000,
    [roomId?.toString(), me],
  );
}
