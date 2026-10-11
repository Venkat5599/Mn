// Node runner for the narration (Bun's WebSocket client cannot reach the Edge TTS service on Windows).
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { AD, PITCH } from "./.script.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const VOICE = process.env.VOICE ?? "en-US-AndrewNeural";
const KBPS = 96;
const out = join(here, "../public/audio");
await mkdir(out, { recursive: true });
const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const durations = {};
for (const [video, scenes] of [["pitch", PITCH], ["ad", AD]]) {
  for (const s of scenes) {
    const id = `${video}-${s.id}`;
    const tmp = join(out, `tmp-${id}`);
    await mkdir(tmp, { recursive: true });
    await tts.toFile(tmp, s.say, { rate: s.rate ?? "+4%" });
    const [file] = (await readdir(tmp)).filter((f) => f.endsWith(".mp3"));
    await rename(join(tmp, file), join(out, `${id}.mp3`));
    await rm(tmp, { recursive: true });
    const { size } = await stat(join(out, `${id}.mp3`));
    durations[id] = Math.round(((size * 8) / (KBPS * 1000)) * 100) / 100;
    console.log(id.padEnd(18), `${durations[id]}s`);
  }
}
await writeFile(join(here, "../src/voice.json"), JSON.stringify(durations, null, 2));
const total = (v) => Object.entries(durations).filter(([k]) => k.startsWith(v)).reduce((n, [, d]) => n + d, 0);
console.log(`pitch voice ${total("pitch").toFixed(1)}s · ad voice ${total("ad").toFixed(1)}s`);
process.exit(0);
