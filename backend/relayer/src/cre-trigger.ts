import { log } from "./log";
import type { ReportedPitch } from "./oracle-reporter";

export interface CreTriggerPayload {
  gamePk: number;
  seq: number;
  playId: string;
}

/**
 * Asks the Chainlink CRE workflow to confirm a pitch. The payload carries the playId so the DON can
 * locate the pitch itself and check the relayer's seq claim, instead of trusting it.
 * Fire-and-forget with retries: confirmation is async by design and the cron sweep is the backstop.
 */
export class CreTrigger {
  constructor(
    private readonly url: string | undefined,
    private readonly gamePk: number,
  ) {}

  fire(p: ReportedPitch) {
    if (!this.url) return;
    const body: CreTriggerPayload = { gamePk: this.gamePk, seq: p.seq, playId: p.playId };
    void this.send(body, 3);
  }

  private async send(body: CreTriggerPayload, attempts: number) {
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await fetch(this.url!, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) return log.debug("cre triggered", { ...body });
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (i === attempts) log.warn("cre trigger failed", { ...body, err: String(err) });
        else await Bun.sleep(500 * i);
      }
    }
  }
}
