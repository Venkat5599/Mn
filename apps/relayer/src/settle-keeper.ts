import { GAS, pitchsideRoomsAbi } from "@pitchside/shared";
import { BaseError, ContractFunctionRevertedError, getAbiItem, type Address } from "viem";
import { confirm, write, type Chainish } from "./chain";
import { log } from "./log";

const BET_PLACED = getAbiItem({ abi: pitchsideRoomsAbi, name: "BetPlaced" });
const MAX_LOG_RANGE = 500n;

interface Market {
  roomId: bigint;
  seq: number;
}

/**
 * Watches BetPlaced for one game and settles every market with bets once the oracle allows it.
 * Anyone may call settle; this keeper just makes it happen within a block of the result.
 */
export class SettleKeeper {
  private readonly pending = new Map<string, Market>();
  private nextBlock: bigint | undefined;

  constructor(
    private readonly c: Chainish,
    private readonly rooms: Address,
    private readonly gamePk: number,
    fromBlock?: bigint,
  ) {
    this.nextBlock = fromBlock;
  }

  get pendingCount() {
    return this.pending.size;
  }

  /** Pull new BetPlaced logs into the pending set. */
  async scan() {
    const latest = await this.c.pub.getBlockNumber();
    let from = this.nextBlock ?? latest;
    while (from <= latest) {
      const to = from + MAX_LOG_RANGE - 1n < latest ? from + MAX_LOG_RANGE - 1n : latest;
      const logs = await this.c.pub.getLogs({
        address: this.rooms,
        event: BET_PLACED,
        args: { gamePk: this.gamePk },
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        const { roomId, seq } = l.args;
        if (roomId === undefined || seq === undefined) continue;
        this.pending.set(`${roomId}:${seq}`, { roomId, seq });
      }
      from = to + 1n;
    }
    this.nextBlock = latest + 1n;
  }

  /** Try to settle everything pending. Markets that are not final yet stay pending. */
  async tick(): Promise<number> {
    let done = 0;
    for (const [key, m] of this.pending) {
      const already = await this.c.pub.readContract({
        address: this.rooms,
        abi: pitchsideRoomsAbi,
        functionName: "settled",
        args: [m.roomId, this.gamePk, m.seq],
      });
      if (already) {
        this.pending.delete(key);
        continue;
      }
      try {
        // Monad bills the limit: size it to this market (a 3-player pot is far cheaper than 32)
        const estimate = await this.c.pub.estimateContractGas({
          address: this.rooms,
          abi: pitchsideRoomsAbi,
          functionName: "settle",
          args: [m.roomId, m.seq],
          account: this.c.account,
        });
        const gas = (estimate * 13n) / 10n < GAS.settle ? (estimate * 13n) / 10n : GAS.settle;
        const hash = await write(this.c, {
          address: this.rooms,
          abi: pitchsideRoomsAbi,
          functionName: "settle",
          args: [m.roomId, m.seq],
          gas,
          label: `settle#${m.roomId}:${m.seq}`,
        });
        await confirm(this.c, hash, "settle");
        this.pending.delete(key);
        done++;
        log.info("market settled", { roomId: m.roomId, seq: m.seq, hash });
      } catch (err) {
        const reason = revertName(err);
        if (reason === "NotFinal") continue; // waiting on the pitch or on CRE
        if (reason === "AlreadySettled" || reason === "NothingToSettle") {
          this.pending.delete(key);
          continue;
        }
        log.warn("settle failed", { roomId: m.roomId, seq: m.seq, reason: reason ?? String(err) });
      }
    }
    return done;
  }
}

export function revertName(err: unknown): string | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const r = err.walk((e) => e instanceof ContractFunctionRevertedError);
  return r instanceof ContractFunctionRevertedError ? r.data?.errorName : undefined;
}
