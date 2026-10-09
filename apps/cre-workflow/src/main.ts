/**
 * Pitchside confirmer: the second, independent oracle source.
 *
 * Every DON node fetches the official MLB feed itself, finds the pitch, maps the call with the SAME
 * mapping code the relayer uses, and the DON only writes when nodes agree (identical consensus).
 * PitchOracle.onReport then voids the pitch if this disagrees with the relayer's fast report.
 *
 * Triggers
 *   HTTP  { gamePk, seq, playId }  sent by the relayer right after each report (fast path)
 *   Cron  sweeps the newest `sweepWindow` pitches and confirms any still unconfirmed (backstop)
 *
 * Runs in CRE's WASM runtime: no fetch / node built-ins, only CRE capabilities.
 */
import {
  type CronPayload,
  cre,
  consensusIdenticalAggregation,
  decodeJson,
  encodeCallMsg,
  getNetwork,
  type HTTPPayload,
  type HTTPSendRequester,
  LAST_FINALIZED_BLOCK_NUMBER,
  ok,
  prepareReportRequest,
  Runner,
  type Runtime,
  text,
  bytesToHex,
} from "@chainlink/cre-sdk";
import { pitchOracleAbi } from "@pitchside/shared/abi";
import { encodeConfirmReport, resolveBySeq, resolveConfirmation } from "@pitchside/shared/confirm";
import { confirmFeedUrl } from "@pitchside/shared/constants";
import type { MlbFeed } from "@pitchside/shared/feed";
import { decodeFunctionResult, encodeFunctionData, zeroAddress, type Address } from "viem";
import { z } from "zod";

const configSchema = z.object({
  chainSelectorName: z.string(),
  isTestnet: z.boolean(),
  oracleAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  gamePk: z.number().int().positive(),
  gasLimit: z.string(),
  sweepSchedule: z.string(),
  sweepWindow: z.number().int().min(1).max(50),
  authorizedKeys: z.array(z.object({ type: z.string(), publicKey: z.string() })),
});
type Config = z.infer<typeof configSchema>;

const requestSchema = z.object({
  gamePk: z.number().int().positive(),
  seq: z.number().int().positive().max(65_535),
  playId: z.string().min(1).max(64),
});

// ───────────── node mode: each DON node runs this on its own HTTP response ─────────────

function fetchFeed(sendRequester: HTTPSendRequester, gamePk: number): MlbFeed {
  const res = sendRequester.sendRequest({ url: confirmFeedUrl(gamePk), method: "GET" }).result();
  if (!ok(res)) throw new Error(`MLB feed HTTP ${res.statusCode}`);
  return JSON.parse(text(res)) as MlbFeed;
}

const outcomeByPlayId = (sr: HTTPSendRequester, req: z.infer<typeof requestSchema>): number =>
  resolveConfirmation(fetchFeed(sr, req.gamePk), req).outcome;

const outcomesBySeq = (sr: HTTPSendRequester, gamePk: number, seqs: number[]): number[] => {
  const feed = fetchFeed(sr, gamePk);
  return seqs.map((s) => resolveBySeq(feed, gamePk, s).outcome);
};

// ───────────── DON mode ─────────────

function evmClient(config: Config) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: config.isTestnet,
  });
  if (!network) throw new Error(`unknown chain selector ${config.chainSelectorName}`);
  return new cre.capabilities.EVMClient(network.chainSelector.selector);
}

function writeConfirmation(runtime: Runtime<Config>, gamePk: number, seq: number, outcome: number) {
  const report = runtime.report(prepareReportRequest(encodeConfirmReport({ gamePk, seq, outcome: outcome as 0 }))).result();
  const reply = evmClient(runtime.config)
    .writeReport(runtime, {
      receiver: runtime.config.oracleAddress,
      report,
      gasConfig: { gasLimit: runtime.config.gasLimit },
    })
    .result();
  runtime.log(`confirmed game ${gamePk} pitch ${seq} -> outcome ${outcome} (tx status ${reply.txStatus})`);
}

function readOracle<T>(runtime: Runtime<Config>, functionName: "lastSeq" | "pitch", args: readonly unknown[]): T {
  const data = encodeFunctionData({ abi: pitchOracleAbi, functionName, args } as never);
  const reply = evmClient(runtime.config)
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: runtime.config.oracleAddress as Address, data }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  return decodeFunctionResult({ abi: pitchOracleAbi, functionName, data: bytesToHex(reply.data) } as never) as T;
}

const onHttp = (runtime: Runtime<Config>, payload: HTTPPayload) => {
  const req = requestSchema.parse(decodeJson(payload.input));
  if (req.gamePk !== runtime.config.gamePk) throw new Error(`workflow is configured for game ${runtime.config.gamePk}`);
  const http = new cre.capabilities.HTTPClient();
  const outcome = http.sendRequest(runtime, outcomeByPlayId, consensusIdenticalAggregation<number>())(req).result();
  writeConfirmation(runtime, req.gamePk, req.seq, outcome);
  return outcome;
};

const onCron = (runtime: Runtime<Config>, _payload: CronPayload) => {
  const { gamePk, sweepWindow } = runtime.config;
  const lastSeq = Number(readOracle<number>(runtime, "lastSeq", [gamePk]));
  const pending: number[] = [];
  for (let seq = Math.max(1, lastSeq - sweepWindow + 1); seq <= lastSeq; seq++) {
    const p = readOracle<{ confirmed: number }>(runtime, "pitch", [gamePk, seq]);
    if (p.confirmed === 0) pending.push(seq);
  }
  if (pending.length === 0) return 0;

  const http = new cre.capabilities.HTTPClient();
  const outcomes = http
    .sendRequest(runtime, outcomesBySeq, consensusIdenticalAggregation<number[]>())(gamePk, pending)
    .result();
  pending.forEach((seq, i) => writeConfirmation(runtime, gamePk, seq, outcomes[i]!));
  return pending.length;
};

const initWorkflow = (config: Config) => [
  cre.handler(new cre.capabilities.HTTPCapability().trigger({ authorizedKeys: config.authorizedKeys as never }), onHttp),
  cre.handler(new cre.capabilities.CronCapability().trigger({ schedule: config.sweepSchedule }), onCron),
];

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
