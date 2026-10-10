/**
 * End-to-end replay of a REAL recorded game against the REAL contracts on a local anvil.
 *
 *   bun run replay                       # fixtures/mlb/feed-849834-final.json
 *   bun run replay -- --fixture <path>   # any saved feed/live JSON
 *
 * Chain time is pinned to the recorded pitch times, so every lock window, late-bet check and
 * settlement happens exactly as it would have during the live game. Five bots play a POINTS room
 * and a STAKES room; the CRE confirmation runs the same `resolveConfirmation` code the DON runs.
 *
 * Exits non-zero if any check fails.
 */
import {
  GAS,
  OUTCOME_LABEL,
  PICKABLE,
  RoomMode,
  encodeConfirmReport,
  flattenPitches,
  maxBetFor,
  mockAusdAbi,
  pitchOracleAbi,
  pitchsideRoomsAbi,
  resolveConfirmation,
  type MlbFeed,
} from "@pitchside/sdk";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { privateKeyToAccount } from "viem/accounts";
import { connect, confirm, write, type Chainish } from "../src/chain";
import { RecordedFeedSource } from "../src/feed-source";
import { OracleReporter } from "../src/oracle-reporter";
import { SettleKeeper } from "../src/settle-keeper";
import { StateStore } from "../src/state";
import { DEV_KEYS, deployLocal, rpc, startAnvil } from "./lib/local-chain";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    fixture: { type: "string", default: join(import.meta.dir, "../../../fixtures/mlb/feed-849834-final.json") },
    port: { type: "string", default: "8546" },
    seed: { type: "string", default: "7" },
  },
});

const LOCK_DELAY = 8;
const BUY_IN = 20_000_000n; // 20 AUSD (6 decimals)

const full = (await Bun.file(values.fixture!).json()) as MlbFeed;
const gamePk = full.gamePk;
const pitches = flattenPitches(full);
if (pitches.length === 0) throw new Error("fixture has no pitches");
const scheduled = Math.floor(Date.parse(full.gameData.datetime?.dateTime ?? "") / 1000);
const t0 = Math.min(Number.isFinite(scheduled) ? scheduled : Infinity, pitches[0]!.startTs) - 120;

console.log(
  `replay: ${full.gameData.teams.away.abbreviation} @ ${full.gameData.teams.home.abbreviation}, ` +
    `gamePk ${gamePk}, ${pitches.length} pitches`,
);

const anvil = await startAnvil(Number(values.port), t0);
const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  if (!ok) failures.push(msg);
};

try {
  const forwarderKey = DEV_KEYS[1]!; // stands in for the Chainlink forwarder ("CRE-simulated")
  const dep = await deployLocal(anvil.url, {
    lockDelay: LOCK_DELAY,
    forwarder: privateKeyToAccount(forwarderKey).address,
  });

  const relayer = connect(dep.chainId, anvil.url, DEV_KEYS[0]!, 25);
  const forwarder = connect(dep.chainId, anvil.url, forwarderKey, 25);
  const bots = DEV_KEYS.slice(2).map((k) => connect(dep.chainId, anvil.url, k, 25));

  // ── rooms ──
  const pointsRoom = await createRoom(bots[0]!, RoomMode.POINTS);
  const stakesRoom = await createRoom(bots[0]!, RoomMode.STAKES);
  for (const b of bots) {
    await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "join", [pointsRoom, 0n], GAS.join);
    await send(b, dep.stakeToken, mockAusdAbi, "mint", [b.account.address, BUY_IN], GAS.mint);
    await send(b, dep.stakeToken, mockAusdAbi, "approve", [dep.pitchsideRooms, BUY_IN], GAS.approve);
    await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "join", [stakesRoom, BUY_IN], GAS.join);
  }

  // ── pipeline under test ──
  const source = new RecordedFeedSource(full);
  const reporter = new OracleReporter(relayer, dep.pitchOracle, gamePk, StateStore.memory(gamePk), () =>
    Number(clockMs),
  );
  const keeper = new SettleKeeper(relayer, dep.pitchsideRooms, gamePk, BigInt(dep.startBlock));
  const rand = mulberry32(Number(values.seed));

  let clockMs = BigInt(t0) * 1000n;
  let bets = 0;
  let confirmations = 0;
  let mismatches = 0;
  let settledBefore = 0;
  const started = performance.now();

  // Pre-game: open the game, bots bet on pitch #1.
  source.cutoffMs = pitches[0]!.startMs - 1;
  await reporter.sync(await source.read());
  bets += await botsBet(1);

  for (const p of pitches) {
    // The world just after pitch `p` ended and the feed caught up (+2s).
    await setChainTime(p.endTs + 2);
    clockMs = BigInt(p.endMs + 2_000);
    source.cutoffMs = p.endMs;
    const visible = await source.read();

    const posted = await reporter.sync(visible);
    check(posted.length === 1 && posted[0]!.seq === p.seq, `pitch ${p.seq}: expected exactly one report`);

    for (const r of posted) {
      const res = resolveConfirmation(visible, { gamePk, seq: r.seq, playId: r.playId });
      if (res.outcome !== r.outcome) mismatches++;
      const hash = await forwarder.wallet.writeContract({
        address: dep.pitchOracle,
        abi: pitchOracleAbi,
        functionName: "onReport",
        args: ["0x", encodeConfirmReport(res)],
        gas: GAS.onReport,
      });
      await confirm(forwarder, hash, "onReport");
      confirmations++;
    }

    await keeper.scan();
    settledBefore += await keeper.tick();
    bets += await botsBet(p.seq + 1);
  }
  // Drain anything the last loop left (dangling market after the final out resolves VOID).
  await keeper.scan();
  settledBefore += await keeper.tick();

  // ── checks ──
  const lastSeq = await relayer.pub.readContract({
    address: dep.pitchOracle,
    abi: pitchOracleAbi,
    functionName: "lastSeq",
    args: [gamePk],
  });
  check(lastSeq === pitches.length, `oracle lastSeq ${lastSeq} != ${pitches.length}`);

  let wrong = 0;
  for (const p of pitches) {
    const onChain = await relayer.pub.readContract({
      address: dep.pitchOracle,
      abi: pitchOracleAbi,
      functionName: "pitch",
      args: [gamePk, p.seq],
    });
    if (onChain.fast !== p.outcome || onChain.confirmed !== p.outcome || Number(onChain.startTs) !== p.startTs)
      wrong++;
  }
  check(wrong === 0, `${wrong} pitches on chain differ from the feed`);
  check(mismatches === 0, `${mismatches} CRE confirmations disagreed`);
  check(keeper.pendingCount === 0, `${keeper.pendingCount} markets never settled`);

  const game = await relayer.pub.readContract({
    address: dep.pitchOracle,
    abi: pitchOracleAbi,
    functionName: "game",
    args: [gamePk],
  });
  check(game.closed, "game was not closed after the final pitch");

  // STAKES conservation: every token is a chip or rake.
  let stakeChips = 0n;
  let pointsChips = 0n;
  for (const b of bots) {
    stakeChips += await chipsOf(relayer, stakesRoom, b.account.address);
    pointsChips += await chipsOf(relayer, pointsRoom, b.account.address);
  }
  const rake = await relayer.pub.readContract({
    address: dep.pitchsideRooms,
    abi: pitchsideRoomsAbi,
    functionName: "rakeAccrued",
  });
  const held = await relayer.pub.readContract({
    address: dep.stakeToken,
    abi: mockAusdAbi,
    functionName: "balanceOf",
    args: [dep.pitchsideRooms],
  });
  check(held === stakeChips + rake, `stake tokens ${held} != chips ${stakeChips} + rake ${rake}`);
  check(held === BUY_IN * BigInt(bots.length), "stake deposits changed");
  check(pointsChips <= 1_000n * BigInt(bots.length), "points were created out of thin air");

  // ── report ──
  const byOutcome = Object.fromEntries(
    PICKABLE.map((o) => [OUTCOME_LABEL[o], pitches.filter((p) => p.outcome === o).length]),
  );
  console.log(
    JSON.stringify(
      {
        gamePk,
        pitchesReported: Number(lastSeq),
        creConfirmations: confirmations,
        betsPlaced: bets,
        marketsSettled: settledBefore,
        pitchesByOutcome: byOutcome,
        stakes: { deposited: held.toString(), rakeAccrued: rake.toString() },
        wallSeconds: Math.round((performance.now() - started) / 1000),
        result: failures.length === 0 ? "PASS" : "FAIL",
        failures,
      },
      null,
      2,
    ),
  );

  // ── helpers (closures over the deployment) ──

  async function createRoom(c: Chainish, mode: number) {
    const next = await c.pub.readContract({
      address: dep.pitchsideRooms,
      abi: pitchsideRoomsAbi,
      functionName: "nextRoomId",
    });
    await send(c, dep.pitchsideRooms, pitchsideRoomsAbi, "createRoom", [mode, gamePk], GAS.createRoom);
    return next;
  }

  function chipsOf(c: Chainish, roomId: bigint, who: `0x${string}`) {
    return c.pub.readContract({
      address: dep.pitchsideRooms,
      abi: pitchsideRoomsAbi,
      functionName: "chips",
      args: [roomId, who],
    });
  }

  async function botsBet(seq: number): Promise<number> {
    const open = await relayer.pub.readContract({
      address: dep.pitchOracle,
      abi: pitchOracleAbi,
      functionName: "isOpenMarket",
      args: [gamePk, seq],
    });
    if (!open) return 0;
    let n = 0;
    for (const b of bots) {
      for (const room of [pointsRoom, stakesRoom]) {
        if (rand() < 0.25) continue; // not everyone bets every pitch
        const stack = await chipsOf(b, room, b.account.address);
        const max = maxBetFor(stack);
        if (max === 0n) continue;
        const amount = 1n + BigInt(Math.floor(rand() * Number(max)));
        const outcome = PICKABLE[Math.floor(rand() * PICKABLE.length)]!;
        await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "bet", [room, seq, outcome, amount], GAS.bet);
        n++;
      }
    }
    return n;
  }
} catch (err) {
  failures.push(err instanceof Error ? err.message : String(err));
  console.error(err);
} finally {
  anvil.stop();
}

if (failures.length) {
  console.error(`replay FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("replay PASS");

// ── utils ──

async function setChainTime(ts: number) {
  const latest = (await rpc(anvil.url, "eth_getBlockByNumber", ["latest", false])) as { timestamp: string };
  const now = Number.parseInt(latest.timestamp, 16);
  await rpc(anvil.url, "evm_setNextBlockTimestamp", [Math.max(ts, now)]);
}

async function send(c: Chainish, address: `0x${string}`, abi: any, functionName: string, args: unknown[], gas: bigint) {
  const hash = await write(c, { address, abi, functionName, args, gas, label: functionName } as never);
  await confirm(c, hash, functionName);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
