/**
 * One-command local stack for building and testing the app without waiting for a real game.
 *
 *   bun run dev:local          (from the repo root), then in another shell: bun run dev:web
 *
 * - anvil on :8545 with the real contracts deployed
 * - the recorded game (gamePk 849834) time-shifted to start ~45s from now, served on :8788 with
 *   the same paths as statsapi.mlb.com, revealing each pitch at its (shifted) real moment
 * - the real relayer loop (OracleReporter + SettleKeeper) and the CRE confirmation path
 * - the gas drip on :8787
 * - three bot friends who join any room you create and call pitches
 * - writes apps/web/.env.local and deployments/31337.json
 *
 * Simulated data is labelled as such: this is a replay of a finished game, not a live one.
 */
import {
  GAS,
  PICKABLE,
  RoomMode,
  encodeConfirmReport,
  flattenPitches,
  gamePhase,
  maxBetFor,
  mockAusdAbi,
  pitchOracleAbi,
  pitchsideRoomsAbi,
  resolveConfirmation,
  type MlbFeed,
} from "@pitchside/shared";
import { join } from "node:path";
import { getAbiItem, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { connect, confirm, write, type Chainish } from "../src/chain";
import { startDripServer } from "../src/drip-server";
import { RecordedFeedSource } from "../src/feed-source";
import { log } from "../src/log";
import { OracleReporter } from "../src/oracle-reporter";
import { SettleKeeper } from "../src/settle-keeper";
import { StateStore } from "../src/state";
import { DEV_KEYS, deployLocal, startAnvil } from "./lib/local-chain";

const ROOT = join(import.meta.dir, "../../..");
const FEED_PORT = 8788;
const LEAD_MS = 45_000;

// ── time-shift the recorded game so its first pitch is LEAD_MS from now ──
const original = (await Bun.file(join(ROOT, "fixtures/mlb/feed-849834-final.json")).json()) as MlbFeed;
const firstStart = flattenPitches(original)[0]!.startMs;
const offset = Date.now() + LEAD_MS - firstStart;
const shift = (iso?: string) => (iso ? new Date(Date.parse(iso) + offset).toISOString() : iso);
const shifted: MlbFeed = structuredClone(original);
shifted.gameData.datetime = { ...shifted.gameData.datetime, dateTime: shift(original.gameData.datetime?.dateTime) };
for (const play of shifted.liveData.plays.allPlays)
  for (const e of play.playEvents) {
    e.startTime = shift(e.startTime);
    e.endTime = shift(e.endTime);
  }
const gamePk = shifted.gamePk;
const source = new RecordedFeedSource(shifted);

// ── chain ──
const anvil = await startAnvil(8545, Math.floor(Date.now() / 1000));
const forwarderKey = DEV_KEYS[1]!;
const dep = await deployLocal(anvil.url, { lockDelay: 8, forwarder: privateKeyToAccount(forwarderKey).address });
const relayer = connect(dep.chainId, anvil.url, DEV_KEYS[0]!, 100);
const forwarder = connect(dep.chainId, anvil.url, forwarderKey, 100);
const bots = DEV_KEYS.slice(2, 5).map((k) => connect(dep.chainId, anvil.url, k, 100));

await Bun.write(join(ROOT, "deployments/31337.json"), JSON.stringify(dep, null, 2));
await Bun.write(
  join(ROOT, "apps/web/.env.local"),
  [
    "# Written by bun run dev:local. Local simulated game, not real data.",
    `NEXT_PUBLIC_CHAIN_ID=${dep.chainId}`,
    `NEXT_PUBLIC_RPC_URL=${anvil.url}`,
    `NEXT_PUBLIC_PITCH_ORACLE=${dep.pitchOracle}`,
    `NEXT_PUBLIC_PITCHSIDE_ROOMS=${dep.pitchsideRooms}`,
    `NEXT_PUBLIC_STAKE_TOKEN=${dep.stakeToken}`,
    "NEXT_PUBLIC_STAKE_TOKEN_IS_MOCK=true",
    `NEXT_PUBLIC_DEPLOY_BLOCK=${dep.startBlock}`,
    "NEXT_PUBLIC_DRIP_URL=http://127.0.0.1:8787",
    `NEXT_PUBLIC_MLB_API=http://127.0.0.1:${FEED_PORT}/api`,
    "NEXT_PUBLIC_ACCOUNT_MODE=device",
    "",
  ].join("\n"),
);

// ── fake statsapi ──
const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
Bun.serve({
  port: FEED_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    source.cutoffMs = Date.now();
    const feed = await source.read();
    if (url.pathname === `/api/v1.1/game/${gamePk}/feed/live`) {
      const pitches = flattenPitches(feed);
      const last = feed.liveData.plays.allPlays.at(-1);
      const lastPitch = pitches.at(-1);
      // linescore: runs are not replayed pitch by pitch, so show the count and inning only
      feed.liveData.linescore = {
        currentInning: last?.about.inning ?? 1,
        isTopInning: (last?.about.halfInning ?? "top") === "top",
        balls: lastPitch?.balls ?? 0,
        strikes: lastPitch?.strikes ?? 0,
        outs: lastPitch?.outs ?? 0,
        teams: { home: { runs: 0 }, away: { runs: 0 } },
      };
      feed.liveData.plays.currentPlay = last;
      if (pitches.length === 0) feed.gameData.status = { abstractGameState: "Preview", detailedState: "Warmup (replay)" };
      return new Response(JSON.stringify(feed), { headers: cors });
    }
    if (url.pathname === "/api/v1/schedule") {
      const state = gamePhase(feed) === "final" ? "Final" : flattenPitches(feed).length ? "Live" : "Preview";
      const body = {
        dates: [
          {
            date: url.searchParams.get("date"),
            games: [
              {
                gamePk,
                gameDate: shifted.gameData.datetime?.dateTime ?? new Date().toISOString(),
                status: { abstractGameState: state, detailedState: `${state} (replay)` },
                description: "Replay of a recorded game",
                teams: {
                  away: { team: { abbreviation: shifted.gameData.teams.away.abbreviation, teamName: shifted.gameData.teams.away.teamName ?? "" } },
                  home: { team: { abbreviation: shifted.gameData.teams.home.abbreviation, teamName: shifted.gameData.teams.home.teamName ?? "" } },
                },
              },
            ],
          },
        ],
      };
      return new Response(JSON.stringify(body), { headers: cors });
    }
    return new Response("not found", { status: 404, headers: cors });
  },
});

startDripServer(relayer, {
  port: 8787,
  wei: parseUnits("0.05", 18),
  dailyCapWei: parseUnits("50", 18),
  allowedOrigin: "*",
});

// ── relayer loop + bots ──
const reporter = new OracleReporter(relayer, dep.pitchOracle, gamePk, StateStore.memory(gamePk));
const keeper = new SettleKeeper(relayer, dep.pitchsideRooms, gamePk, BigInt(dep.startBlock));
const ROOM_CREATED = getAbiItem({ abi: pitchsideRoomsAbi, name: "RoomCreated" });
const botRooms = new Map<bigint, number>(); // roomId -> mode
let roomScanFrom = BigInt(dep.startBlock);

console.log(`
  Pitchside local stack is up (simulated game, replay of gamePk ${gamePk})
  chain     ${anvil.url}  (chain id ${dep.chainId})
  rooms     ${dep.pitchsideRooms}
  oracle    ${dep.pitchOracle}
  feed      http://127.0.0.1:${FEED_PORT}/api   first pitch in ${LEAD_MS / 1000}s
  web env   apps/web/.env.local written. Now run: bun run dev:web
`);

process.on("SIGINT", () => {
  anvil.stop();
  process.exit(0);
});

for (;;) {
  const started = Date.now();
  try {
    source.cutoffMs = Date.now();
    const feed = await source.read();
    for (const r of await reporter.sync(feed)) {
      const res = resolveConfirmation(feed, { gamePk, seq: r.seq, playId: r.playId });
      await confirm(
        forwarder,
        await forwarder.wallet.writeContract({
          address: dep.pitchOracle,
          abi: pitchOracleAbi,
          functionName: "onReport",
          args: ["0x", encodeConfirmReport(res)],
          gas: GAS.onReport,
        }),
        "onReport",
      );
    }
    await keeper.scan();
    await keeper.tick();
    await botsPlay();
  } catch (err) {
    log.warn("local loop", { err: err instanceof Error ? err.message.split("\n")[0] : String(err) });
  }
  await Bun.sleep(Math.max(0, 1_000 - (Date.now() - started)));
}

async function botsPlay() {
  const latest = await relayer.pub.getBlockNumber();
  if (latest >= roomScanFrom) {
    const logs = await relayer.pub.getLogs({ address: dep.pitchsideRooms, event: ROOM_CREATED, fromBlock: roomScanFrom, toBlock: latest });
    roomScanFrom = latest + 1n;
    for (const l of logs) {
      const { roomId, mode } = l.args;
      if (roomId === undefined || mode === undefined) continue;
      for (const b of bots) await botJoin(b, roomId, mode);
      botRooms.set(roomId, mode);
    }
  }
  const game = await relayer.pub.readContract({ address: dep.pitchOracle, abi: pitchOracleAbi, functionName: "game", args: [gamePk] });
  const seq = game.lastSeq + 1;
  const open = await relayer.pub.readContract({ address: dep.pitchOracle, abi: pitchOracleAbi, functionName: "isOpenMarket", args: [gamePk, seq] });
  if (!open) return;
  for (const [roomId] of botRooms)
    for (const b of bots) {
      const placed = await relayer.pub.readContract({ address: dep.pitchsideRooms, abi: pitchsideRoomsAbi, functionName: "betOf", args: [roomId, gamePk, seq, b.account.address] });
      if (placed.amount > 0n || Math.random() < 0.3) continue;
      const stack = await relayer.pub.readContract({ address: dep.pitchsideRooms, abi: pitchsideRoomsAbi, functionName: "chips", args: [roomId, b.account.address] });
      const max = maxBetFor(stack);
      if (max === 0n) continue;
      const amount = 1n + BigInt(Math.floor(Math.random() * Number(max / 3n + 1n)));
      const outcome = PICKABLE[Math.floor(Math.random() * PICKABLE.length)]!;
      await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "bet", [roomId, seq, outcome, amount > max ? max : amount], GAS.bet).catch(() => {});
    }
}

async function botJoin(b: Chainish, roomId: bigint, mode: number) {
  if (mode === RoomMode.STAKES) {
    const buyIn = parseUnits("10", 6);
    await send(b, dep.stakeToken, mockAusdAbi, "mint", [b.account.address, buyIn], GAS.mint);
    await send(b, dep.stakeToken, mockAusdAbi, "approve", [dep.pitchsideRooms, buyIn], GAS.approve);
    await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "join", [roomId, buyIn], GAS.join);
  } else {
    await send(b, dep.pitchsideRooms, pitchsideRoomsAbi, "join", [roomId, 0n], GAS.join);
  }
  log.info("bot joined", { roomId, bot: b.account.address });
}

async function send(c: Chainish, address: `0x${string}`, abi: any, functionName: string, args: unknown[], gas: bigint) {
  const hash = await write(c, { address, abi, functionName, args, gas, label: functionName } as never);
  await confirm(c, hash, functionName);
}
