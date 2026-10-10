import type { Account, Address, Chain, Hash, PublicClient, Transport, WalletClient } from "viem";
import { parseEventLogs } from "viem";
import { pitchOracleAbi, pitchsideRoomsAbi } from "./abi";
import { GAS } from "./chains";
import { RoomMode } from "./constants";
import type { Deployment } from "./deployment";
import { Outcome, type Pick } from "./outcome";

export interface Room {
  roomId: bigint;
  host: Address;
  mode: RoomMode;
  rakeBps: number;
  gamePk: number;
  players: number;
  openMarkets: number;
}

export interface Market {
  gamePk: number;
  seq: number;
  /** unix seconds; bets are rejected at or after this */
  lockAt: number;
  open: boolean;
  /** pot per Outcome index (0 and VOID unused) */
  pot: bigint[];
  settled: boolean;
  /** NONE until final for this room's mode */
  outcome: Outcome;
}

type AnyPublic = PublicClient<Transport, Chain | undefined>;
type AnyWallet = WalletClient<Transport, Chain | undefined, Account>;

/**
 * Typed client for Pitchside on Monad.
 *
 *   const px = new PitchsideClient({ publicClient, deployment });
 *   const room = await px.getRoom(1n);
 *   const market = await px.getOpenMarket(1n);
 *   await px.bet(wallet, 1n, market.seq, Outcome.STRIKE, 50n);
 *
 * Every write sets an explicit gas limit: Monad bills the limit, not the gas used.
 */
export class PitchsideClient {
  readonly publicClient: AnyPublic;
  readonly deployment: Deployment;

  constructor(opts: { publicClient: AnyPublic; deployment: Deployment }) {
    this.publicClient = opts.publicClient;
    this.deployment = opts.deployment;
  }

  private get rooms() {
    return { address: this.deployment.pitchsideRooms, abi: pitchsideRoomsAbi } as const;
  }

  private get oracle() {
    return { address: this.deployment.pitchOracle, abi: pitchOracleAbi } as const;
  }

  // ───────────── reads ─────────────

  async getRoom(roomId: bigint): Promise<Room | undefined> {
    const [host, mode, rakeBps, gamePk, players, openMarkets] = await this.publicClient.readContract({
      ...this.rooms,
      functionName: "rooms",
      args: [roomId],
    });
    if (host === "0x0000000000000000000000000000000000000000") return undefined;
    return { roomId, host, mode: mode as RoomMode, rakeBps, gamePk, players, openMarkets };
  }

  async getMarket(roomId: bigint, seq: number): Promise<Market> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error(`room ${roomId} does not exist`);
    const [lockAt, open, pot, settled, outcome] = await Promise.all([
      this.publicClient.readContract({ ...this.oracle, functionName: "marketLockAt", args: [room.gamePk, seq] }),
      this.publicClient.readContract({ ...this.oracle, functionName: "isOpenMarket", args: [room.gamePk, seq] }),
      this.publicClient.readContract({ ...this.rooms, functionName: "potOf", args: [roomId, room.gamePk, seq] }),
      this.publicClient.readContract({ ...this.rooms, functionName: "settled", args: [roomId, room.gamePk, seq] }),
      this.publicClient.readContract({
        ...this.oracle,
        functionName: "finalOutcome",
        args: [room.gamePk, seq, room.mode === RoomMode.STAKES],
      }),
    ]);
    return { gamePk: room.gamePk, seq, lockAt: Number(lockAt), open, pot: [...pot], settled, outcome: outcome as Outcome };
  }

  /** The market taking bets right now (the pitch after the last reported one). */
  async getOpenMarket(roomId: bigint): Promise<Market> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error(`room ${roomId} does not exist`);
    const last = await this.publicClient.readContract({ ...this.oracle, functionName: "lastSeq", args: [room.gamePk] });
    return this.getMarket(roomId, last + 1);
  }

  /** Season table: every member's chip stack, highest first. */
  async getStandings(roomId: bigint): Promise<{ address: Address; chips: bigint }[]> {
    const members = await this.publicClient.readContract({ ...this.rooms, functionName: "members", args: [roomId] });
    const chips = await Promise.all(
      members.map((m) => this.publicClient.readContract({ ...this.rooms, functionName: "chips", args: [roomId, m] })),
    );
    return members
      .map((address, i) => ({ address, chips: chips[i] ?? 0n }))
      .sort((a, b) => (b.chips > a.chips ? 1 : b.chips < a.chips ? -1 : 0));
  }

  // ───────────── writes ─────────────

  async createRoom(wallet: AnyWallet, mode: RoomMode, gamePk: number): Promise<{ roomId: bigint; hash: Hash }> {
    const hash = await wallet.writeContract({
      ...this.rooms,
      functionName: "createRoom",
      args: [mode, gamePk],
      gas: GAS.createRoom,
      chain: wallet.chain,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const [created] = parseEventLogs({ abi: pitchsideRoomsAbi, eventName: "RoomCreated", logs: receipt.logs });
    if (!created) throw new Error("RoomCreated event not found");
    return { roomId: created.args.roomId, hash };
  }

  /** POINTS: amount 0. STAKES: approve the stake token to `deployment.pitchsideRooms` first. */
  join(wallet: AnyWallet, roomId: bigint, amount = 0n) {
    return wallet.writeContract({ ...this.rooms, functionName: "join", args: [roomId, amount], gas: GAS.join, chain: wallet.chain });
  }

  bet(wallet: AnyWallet, roomId: bigint, seq: number, outcome: Pick, amount: bigint) {
    return wallet.writeContract({
      ...this.rooms,
      functionName: "bet",
      args: [roomId, seq, outcome, amount],
      gas: GAS.bet,
      chain: wallet.chain,
    });
  }

  /** Anyone may settle. Gas is estimated for this market and capped at the 32-player worst case. */
  async settle(wallet: AnyWallet, roomId: bigint, seq: number) {
    const estimate = await this.publicClient.estimateContractGas({
      ...this.rooms,
      functionName: "settle",
      args: [roomId, seq],
      account: wallet.account,
    });
    const gas = (estimate * 13n) / 10n < GAS.settle ? (estimate * 13n) / 10n : GAS.settle;
    return wallet.writeContract({ ...this.rooms, functionName: "settle", args: [roomId, seq], gas, chain: wallet.chain });
  }

  cashOut(wallet: AnyWallet, roomId: bigint, to: Address) {
    return wallet.writeContract({ ...this.rooms, functionName: "cashOut", args: [roomId, to], gas: GAS.cashOut, chain: wallet.chain });
  }
}
