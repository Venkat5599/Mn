"use client";

import {
  GAS,
  RoomMode,
  dripMessage,
  mockAusdAbi,
  pitchsideRoomsAbi,
  type Pick,
} from "@pitchside/shared";
import { erc20Abi, parseEther, parseEventLogs, type Address, type Hash, type LocalAccount } from "viem";
import { publicClient, walletFor } from "./chain";
import { env } from "./env";

/** Enough MON for ~100 bets on Monad testnet. Below this we ask the relayer for a drip. */
const MIN_GAS_BALANCE = parseEther("0.01");

async function waitFor(hash: Hash, label: string) {
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 20_000 });
  if (r.status !== "success") throw new Error(`${label} failed on chain`);
  return r;
}

/** Signed request to the relayer's drip; resolves once `target` can pay gas. */
export async function ensureGas(main: LocalAccount, target: Address) {
  const balance = await publicClient.getBalance({ address: target });
  if (balance >= MIN_GAS_BALANCE) return;
  if (!env.dripUrl) throw new Error("No MON for gas and no drip configured.");
  const signature = await main.signMessage({ message: dripMessage(target) });
  const res = await fetch(`${env.dripUrl}/drip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, mainAccount: main.address, signature }),
  });
  const body = (await res.json().catch(() => ({}))) as { hash?: Hash; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Gas drip failed (${res.status})`);
  if (body.hash) await waitFor(body.hash, "Gas drip");
}

export async function createRoom(main: LocalAccount, mode: RoomMode, gamePk: number): Promise<bigint> {
  await ensureGas(main, main.address);
  const hash = await walletFor(main).writeContract({
    address: env.rooms,
    abi: pitchsideRoomsAbi,
    functionName: "createRoom",
    args: [mode, gamePk],
    gas: GAS.createRoom,
  });
  const receipt = await waitFor(hash, "Create room");
  const [created] = parseEventLogs({ abi: pitchsideRoomsAbi, eventName: "RoomCreated", logs: receipt.logs });
  if (!created) throw new Error("Room created but no RoomCreated event found");
  return created.args.roomId;
}

/**
 * Join with the room key. POINTS: free chips. STAKES: the buy-in moves to the room key first,
 * so the room key never holds more than this room's stake.
 */
export async function joinRoom(opts: {
  main: LocalAccount;
  room: LocalAccount;
  roomId: bigint;
  mode: RoomMode;
  buyIn: bigint;
}) {
  const { main, room, roomId, mode, buyIn } = opts;
  await ensureGas(main, room.address);
  const roomWallet = walletFor(room);

  if (mode === RoomMode.STAKES) {
    if (env.stakeTokenIsMock) {
      // testnet only: the mock token lets anyone mint test AUSD
      await waitFor(
        await roomWallet.writeContract({
          address: env.stakeToken,
          abi: mockAusdAbi,
          functionName: "mint",
          args: [room.address, buyIn],
          gas: GAS.mint,
        }),
        "Mint test AUSD",
      );
    } else {
      await ensureGas(main, main.address);
      await waitFor(
        await walletFor(main).writeContract({
          address: env.stakeToken,
          abi: erc20Abi,
          functionName: "transfer",
          args: [room.address, buyIn],
          gas: GAS.approve,
        }),
        "Move buy-in to room key",
      );
    }
    await waitFor(
      await roomWallet.writeContract({
        address: env.stakeToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [env.rooms, buyIn],
        gas: GAS.approve,
      }),
      "Approve buy-in",
    );
  }

  await waitFor(
    await roomWallet.writeContract({
      address: env.rooms,
      abi: pitchsideRoomsAbi,
      functionName: "join",
      args: [roomId, mode === RoomMode.STAKES ? buyIn : 0n],
      gas: GAS.join,
    }),
    "Join room",
  );
}

/** Signs silently with the room key. Returns the hash immediately for optimistic UI. */
export function placeBet(room: LocalAccount, roomId: bigint, seq: number, outcome: Pick, amount: bigint) {
  return walletFor(room).writeContract({
    address: env.rooms,
    abi: pitchsideRoomsAbi,
    functionName: "bet",
    args: [roomId, seq, outcome, amount],
    gas: GAS.bet,
  });
}

export async function cashOut(room: LocalAccount, roomId: bigint, to: Address) {
  const hash = await walletFor(room).writeContract({
    address: env.rooms,
    abi: pitchsideRoomsAbi,
    functionName: "cashOut",
    args: [roomId, to],
    gas: GAS.cashOut,
  });
  await waitFor(hash, "Cash out");
  return hash;
}

export { waitFor };
