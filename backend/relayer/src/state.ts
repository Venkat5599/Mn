import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";

interface Persisted {
  gamePk: number;
  /** seq -> playId as reported on chain. Used to detect feed renumbering. */
  reported: Record<number, string>;
}

/** Tiny crash-safe JSON store (write to tmp, then rename). */
export class StateStore {
  private data: Persisted;
  private readonly file: string;

  private constructor(file: string, data: Persisted) {
    this.file = file;
    this.data = data;
  }

  static async open(dir: string, gamePk: number): Promise<StateStore> {
    await mkdir(dir, { recursive: true });
    const file = join(dir, `game-${gamePk}.json`);
    const f = Bun.file(file);
    const data: Persisted = (await f.exists()) ? await f.json() : { gamePk, reported: {} };
    return new StateStore(file, data);
  }

  static memory(gamePk: number): StateStore {
    const s = new StateStore("", { gamePk, reported: {} });
    s.save = async () => {};
    return s;
  }

  playIdAt(seq: number): string | undefined {
    return this.data.reported[seq];
  }

  async markReported(seq: number, playId: string) {
    this.data.reported[seq] = playId;
    await this.save();
  }

  async save() {
    const tmp = `${this.file}.tmp`;
    await Bun.write(tmp, JSON.stringify(this.data));
    await rename(tmp, this.file);
  }
}
