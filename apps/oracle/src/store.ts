import type { ChallengeRecord, Evidence, Sla } from "@hyperhedge/sdk";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Hex } from "viem";

/** Everything the oracle knows about one contract. Persisted after every change so a restart loses nothing. */
export interface Tracked {
  id: string;
  sla: Sla | null;
  slaError?: string;
  windowStart: number;
  windowEnd: number;
  challenges: ChallengeRecord[];
  evidenceHash?: Hex;
  reportTx?: Hex;
  abstained?: string;
}

export class Store {
  private constructor(
    private readonly dir: string,
    public readonly contracts: Map<string, Tracked>,
    public scannedTo: number,
  ) {}

  static async open(dir: string, startBlock: number): Promise<Store> {
    await mkdir(join(dir, "evidence"), { recursive: true });
    const f = Bun.file(join(dir, "state.json"));
    if (await f.exists()) {
      const s = (await f.json()) as { scannedTo: number; contracts: Tracked[] };
      return new Store(dir, new Map(s.contracts.map((c) => [c.id, c])), s.scannedTo);
    }
    return new Store(dir, new Map(), startBlock - 1);
  }

  async save() {
    const tmp = join(this.dir, "state.json.tmp");
    await Bun.write(tmp, JSON.stringify({ scannedTo: this.scannedTo, contracts: [...this.contracts.values()] }));
    await rename(tmp, join(this.dir, "state.json")); // atomic: never a half-written state file
  }

  async saveEvidence(hash: Hex, e: Evidence, canonical: string) {
    await Bun.write(join(this.dir, "evidence", `${hash}.json`), canonical);
    return e;
  }

  evidenceFile(hash: string) {
    if (!/^0x[0-9a-f]{64}$/.test(hash)) return undefined;
    return Bun.file(join(this.dir, "evidence", `${hash}.json`));
  }
}
