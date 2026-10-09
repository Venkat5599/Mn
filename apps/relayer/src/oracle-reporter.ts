import { GAS, flattenPitches, gamePhase, pitchOracleAbi, type FlatPitch, type MlbFeed } from "@pitchside/shared";
import type { Address } from "viem";
import { confirm, write, type Chainish } from "./chain";
import { log } from "./log";
import type { StateStore } from "./state";

export interface ReportedPitch extends FlatPitch {
  txHash: `0x${string}`;
  /** wall-clock ms from the pitch ending to the report being included on chain */
  latencyMs: number;
}

/**
 * Posts every new pitch in the feed to PitchOracle, strictly in order.
 * Idempotent: on restart it reads lastSeq from chain and continues from there.
 */
export class OracleReporter {
  constructor(
    private readonly c: Chainish,
    private readonly oracle: Address,
    private readonly gamePk: number,
    private readonly state: StateStore,
    private readonly now: () => number = Date.now,
  ) {}

  async sync(feed: MlbFeed): Promise<ReportedPitch[]> {
    const pitches = flattenPitches(feed);
    const game = await this.c.pub.readContract({
      address: this.oracle,
      abi: pitchOracleAbi,
      functionName: "game",
      args: [this.gamePk],
    });
    if (game.closed) return [];

    if (!game.open) await this.openGame(feed, pitches);
    this.checkRenumbering(pitches, game.lastSeq);

    const posted: ReportedPitch[] = [];
    for (let seq = game.lastSeq + 1; seq <= pitches.length; seq++) {
      posted.push(await this.report(pitches[seq - 1]!));
    }

    if (gamePhase(feed) === "final" && pitches.length > 0) await this.closeGame(pitches.length);
    return posted;
  }

  private async openGame(feed: MlbFeed, pitches: FlatPitch[]) {
    const scheduled = Date.parse(feed.gameData.datetime?.dateTime ?? "");
    const firstPitch = pitches[0]?.startTs;
    // Close market #1 just before the first pitch. If it has not happened yet, at the scheduled time,
    // but never less than 30s from now: a late start must not leave pitch #1 with no window at all.
    // An early first pitch is safe either way, because bets stamped after it are refunded on chain.
    const nowSec = Math.floor(this.now() / 1000);
    const firstLockAt =
      firstPitch !== undefined
        ? firstPitch - 1
        : Math.max(Number.isFinite(scheduled) ? Math.floor(scheduled / 1000) : 0, nowSec + 30);
    const hash = await write(this.c, {
      address: this.oracle,
      abi: pitchOracleAbi,
      functionName: "openGame",
      args: [this.gamePk, BigInt(firstLockAt)],
      gas: GAS.openGame,
      label: "openGame",
    });
    await confirm(this.c, hash, "openGame");
    log.info("game opened", { gamePk: this.gamePk, firstLockAt, hash });
  }

  private async report(p: FlatPitch): Promise<ReportedPitch> {
    const hash = await write(this.c, {
      address: this.oracle,
      abi: pitchOracleAbi,
      functionName: "reportPitch",
      args: [this.gamePk, p.seq, p.outcome, BigInt(p.startTs), BigInt(p.endTs)],
      gas: GAS.reportPitch,
      label: `reportPitch#${p.seq}`,
    });
    // Strict ordering: wait for inclusion before the next seq so a dropped tx can never leave a gap.
    await confirm(this.c, hash, `reportPitch#${p.seq}`);
    await this.state.markReported(p.seq, p.playId);
    const latencyMs = this.now() - p.endMs;
    log.info("pitch reported", {
      gamePk: this.gamePk,
      seq: p.seq,
      call: p.callDescription,
      outcome: p.outcome,
      latencyMs,
      hash,
    });
    return { ...p, txHash: hash, latencyMs };
  }

  private async closeGame(lastSeq: number) {
    const hash = await write(this.c, {
      address: this.oracle,
      abi: pitchOracleAbi,
      functionName: "closeGame",
      args: [this.gamePk],
      gas: GAS.closeGame,
      label: "closeGame",
    });
    await confirm(this.c, hash, "closeGame");
    log.info("game closed", { gamePk: this.gamePk, lastSeq, hash });
  }

  /**
   * MLB occasionally rewrites history (a pitch removed on review). Seqs already on chain cannot move,
   * so we shout: CRE compares by playId and will void every pitch whose position no longer matches.
   */
  private checkRenumbering(pitches: FlatPitch[], lastSeq: number) {
    for (let seq = Math.max(1, lastSeq - 5); seq <= lastSeq; seq++) {
      const onChain = this.state.playIdAt(seq);
      const now = pitches[seq - 1]?.playId;
      if (onChain && now && onChain !== now) {
        log.error("feed renumbered after report", { seq, onChain, now });
      }
    }
  }
}
