/**
 * Pitchside relayer: one process per live game.
 *   feed watcher  -> polls MLB every POLL_MS
 *   reporter      -> posts each new pitch to PitchOracle, in order
 *   CRE trigger   -> asks the Chainlink workflow to confirm it
 *   keeper        -> settles every room market as soon as the oracle allows
 *   drip server   -> funds new room keys with a little MON
 */
import { gamePhase } from "@pitchside/shared";
import { connect } from "./chain";
import { loadConfig } from "./config";
import { CreTrigger } from "./cre-trigger";
import { startDripServer } from "./drip-server";
import { HttpFeedSource } from "./feed-source";
import { log } from "./log";
import { OracleReporter } from "./oracle-reporter";
import { SettleKeeper } from "./settle-keeper";
import { StateStore } from "./state";

const cfg = await loadConfig();
const c = connect(cfg.chainId, cfg.rpcUrl, cfg.privateKey);
const state = await StateStore.open(cfg.stateDir, cfg.gamePk);
const feed = new HttpFeedSource(cfg.gamePk);
const reporter = new OracleReporter(c, cfg.deployment.pitchOracle, cfg.gamePk, state);
const keeper = new SettleKeeper(c, cfg.deployment.pitchsideRooms, cfg.gamePk, BigInt(cfg.deployment.startBlock));
const cre = new CreTrigger(cfg.creTriggerUrl, cfg.gamePk);
const drip = startDripServer(c, cfg.drip);

log.info("relayer up", {
  gamePk: cfg.gamePk,
  chainId: cfg.chainId,
  relayer: c.account.address,
  oracle: cfg.deployment.pitchOracle,
  rooms: cfg.deployment.pitchsideRooms,
  cre: cfg.creTriggerUrl ? "http trigger" : "cron sweep only",
});

let running = true;
let failures = 0;
const stop = () => {
  running = false;
  drip.stop();
  log.info("relayer stopping");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

while (running) {
  const started = Date.now();
  try {
    const snapshot = await feed.read();
    const posted = await reporter.sync(snapshot);
    for (const p of posted) cre.fire(p);
    await keeper.scan();
    await keeper.tick();
    failures = 0;

    if (gamePhase(snapshot) === "final" && keeper.pendingCount === 0) {
      log.info("game final and every market settled");
      // Keep the keeper alive for Stakes rooms still waiting on CRE; exit once nothing is pending.
      stop();
    }
  } catch (err) {
    failures++;
    log.warn("loop error", { failures, err: err instanceof Error ? err.message : String(err) });
    await Bun.sleep(Math.min(10_000, 500 * 2 ** Math.min(failures, 5)));
  }
  await Bun.sleep(Math.max(0, cfg.pollMs - (Date.now() - started)));
}
