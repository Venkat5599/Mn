/**
 * Pitch and ad films in huashu-art-motion's keynote grammar (github.com/alchaincyf/huashu-art-motion).
 * One table below defines every shot. This script writes the t2 specs and the storyboard, renders each shot with
 * the skill's Python renderer, joins the shots and lays the existing narration under them.
 *
 *   bun huashu/build.ts <pitch|ad|all> [--only <shot id>] [--stills]
 *
 * Needs HUASHU_ENGINE pointing at huashu-art-motion/scripts/engine, plus uv and ffmpeg on PATH. Three local patches
 * to that engine were used for these renders:
 *   render.py:69     chromium.launch(channel="chrome", ...)  — use the installed Chrome, no browser download
 *   render.py:74     skip "status of 404" console errors       — the clip page has no favicon
 *   lib/media.js     MD.label resets letterSpacing to 0 and sets Latin-only labels in Inter
 *                    — the number slam leaves negative tracking set and the PuHui subset has no Latin space
 * On Windows run with PYTHONUTF8=1 (this script sets it for the renderer).
 */
import { $ } from "bun";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import voice from "../src/voice.json";

const ROOT = resolve(import.meta.dir);
const ENGINE = process.env.HUASHU_ENGINE;
if (!ENGINE) throw new Error("set HUASHU_ENGINE to huashu-art-motion/scripts/engine");
const SHOTS = resolve(ROOT, "../public/shots");
const AUDIO = resolve(ROOT, "../public/audio");
const OUT = resolve(ROOT, "../out/huashu");

// The site's palette: navy ink on a pale blue-grey ground, brand blue to point, green for proven and paid.
const THEME = { bg: "#EEF3F8", surface: "#FFFFFF", ink: "#0B1526", sub: "#46516A", accent: "#1A54B0", accent2: "#1F9D55" };

const LEAD = 0.25; // air before each narration line
const TAIL = 0.35; // air after

type Cue = { at: number; kind: "card" | "highlight" | "number"; text?: string; sub?: string; image?: string; data?: Record<string, unknown> };
type Shot = { id: string; obj: string; act: string; cam: "停" | "快推" | "横移" | "砸入" | "切"; label: string; cues: (len: number) => Cue[] };
type Scene = { voice: string; shots: Shot[] };

const img = (n: string) => join(SHOTS, `${n}.png`).replaceAll("\\", "/");

// Highlight rects are [x, y, w, h] as fractions of the 1920×1080 screenshot.
const R = {
  heroHead: [0.34, 0.3, 0.33, 0.17],
  heroCta: [0.41, 0.6, 0.18, 0.06],
  tape: [0.155, 0.28, 0.405, 0.075],
  c1Proof: [0.155, 0.75, 0.62, 0.04],
  c1Policy: [0.155, 0.72, 0.62, 0.04],
  c2Verify: [0.16, 0.46, 0.26, 0.06],
  c3Status: [0.15, 0.175, 0.17, 0.04],
  c3Host: [0.575, 0.72, 0.22, 0.04],
  c1Collateral: [0.455, 0.625, 0.3, 0.045],
  c4Proof: [0.155, 0.865, 0.62, 0.04],
  c4Buy: [0.585, 0.23, 0.18, 0.37],
  c4Collateral: [0.455, 0.725, 0.3, 0.045],
  stlTable: [0.145, 0.36, 0.64, 0.19],
  stlPaid: [0.3, 0.19, 0.16, 0.09],
  vault: [0.145, 0.21, 0.32, 0.38],
  curve: [0.47, 0.52, 0.31, 0.43],
};

const PITCH: Scene[] = [
  {
    voice: "pitch-team",
    shots: [
      {
        id: "p01", obj: "HYPERHEDGE landing page", act: "the headline lands, then the actions", cam: "快推", label: "",
        cues: (L) => [
          { at: 0, kind: "card", text: "Venkat, solo builder", sub: "Monad Metropolis", image: img("landing-hero") },
          { at: Math.min(1.6, L - 2), kind: "highlight", text: "HYPERHEDGE", data: { rect: R.heroHead } },
        ],
      },
    ],
  },
  {
    voice: "pitch-problem",
    shots: [
      {
        id: "p02", obj: "contract #3 proof tape", act: "every challenge to the host goes unanswered", cam: "快推", label: "No delivery",
        cues: (L) => [
          { at: 0, kind: "card", text: "Prepaid GPU capacity", sub: "weeks in advance", image: img("c3") },
          { at: L * 0.45, kind: "highlight", text: "No delivery", data: { rect: R.tape } },
        ],
      },
      {
        id: "p03", obj: "contract #3 terms", act: "the host line names a host that never answers", cam: "横移", label: "No hedge",
        cues: (L) => [
          { at: 0, kind: "card", text: "The buyer eats the loss", image: img("c3") },
          { at: L * 0.4, kind: "highlight", text: "No hedge today", data: { rect: R.c3Host } },
        ],
      },
      {
        id: "p03b", obj: "contract #2 proof tape", act: "the tape turns red where the host stopped", cam: "切", label: "Credits",
        cues: (L) => [
          { at: 0, kind: "card", text: "Today: credits from the same provider", image: img("c2-verify") },
          { at: L * 0.4, kind: "highlight", text: "Missed proofs", data: { rect: R.tape } },
        ],
      },
    ],
  },
  {
    voice: "pitch-solution",
    shots: [
      {
        id: "p04", obj: "contract #4 buy panel", act: "the buyer prices protection per unit", cam: "快推", label: "Premium",
        cues: (L) => [
          { at: 0, kind: "card", text: "Delivery risk, priced", image: img("c4") },
          { at: L * 0.35, kind: "highlight", text: "Buyer pays a premium", data: { rect: R.c4Buy } },
        ],
      },
      {
        id: "p05", obj: "contract #4 collateral line", act: "900 hhUSD sits locked before any sale", cam: "砸入", label: "900 locked",
        cues: (L) => [
          { at: 0, kind: "card", text: "Seller locks the payout", image: img("c4") },
          { at: L * 0.25, kind: "highlight", text: "Locked first", data: { rect: R.c4Collateral } },
          { at: L * 0.62, kind: "number", text: "locked before the sale", data: { value: 900, suffix: " hhUSD", over: true } },
        ],
      },
      {
        id: "p05b", obj: "contract #1 collateral line", act: "the payout sits reserved for the buyer", cam: "横移", label: "Never unpaid",
        cues: (L) => [
          { at: 0, kind: "card", text: "Protection never goes unpaid", image: img("c1") },
          { at: L * 0.35, kind: "highlight", text: "Equal to the max payout", data: { rect: R.c1Collateral } },
        ],
      },
    ],
  },
  {
    voice: "pitch-proof",
    shots: [
      {
        id: "p06", obj: "contract #1 proof tape", act: "twelve cells fill blue, one per proof", cam: "快推", label: "12 of 12",
        cues: (L) => [
          { at: 0, kind: "card", text: "Proven, not claimed", sub: "contract #1", image: img("c1") },
          { at: L * 0.3, kind: "highlight", text: "12 of 12 proven", data: { rect: R.tape } },
        ],
      },
      {
        id: "p07", obj: "contract #1 proof rule", act: "the SLA asks for 2^20 hashes every 15 s", cam: "砸入", label: "15 s",
        cues: (L) => [
          { at: 0, kind: "card", text: "Seeded by Monad blocks", image: img("c1") },
          { at: L * 0.2, kind: "highlight", text: "Fresh seed each time", data: { rect: R.c1Proof } },
          { at: L * 0.55, kind: "number", text: "seconds between challenges", data: { value: 15, suffix: " s", over: true } },
        ],
      },
      {
        id: "p07b", obj: "contract #2 proof tape", act: "each missed cell is kept as evidence", cam: "切", label: "Evidence",
        cues: (L) => [
          { at: 0, kind: "card", text: "Every miss becomes evidence", image: img("c2-verify") },
          { at: L * 0.35, kind: "highlight", text: "3 of 12 answered", data: { rect: R.tape } },
        ],
      },
    ],
  },
  {
    voice: "pitch-settle",
    shots: [
      {
        id: "p08", obj: "contract #2 evidence check", act: "the browser re-checks every proof and hash", cam: "快推", label: "Verified",
        cues: (L) => [
          { at: 0, kind: "card", text: "2 of 3 signers report", image: img("c2-verify") },
          { at: L * 0.35, kind: "highlight", text: "Re-checked in your browser", data: { rect: R.c2Verify } },
        ],
      },
      {
        id: "p09", obj: "contract #3 settled status", act: "the dispute fails and the bond goes to buyers", cam: "砸入", label: "110 each",
        cues: (L) => [
          { at: 0, kind: "card", text: "Dispute a valid failure, lose the bond", image: img("c3") },
          { at: L * 0.2, kind: "highlight", text: "Settled", data: { rect: R.c3Status } },
          { at: L * 0.55, kind: "number", text: "to each buyer", data: { value: 110, suffix: " hhUSD", over: true } },
        ],
      },
      {
        id: "p09b", obj: "settlements totals", act: "the paid-out total sits final onchain", cam: "快推", label: "400",
        cues: (L) => [
          { at: 0, kind: "card", text: "Buyers paid from collateral", image: img("settlements") },
          { at: L * 0.35, kind: "highlight", text: "400 hhUSD paid out", data: { rect: R.stlPaid } },
        ],
      },
    ],
  },
  {
    voice: "pitch-monad",
    shots: [
      {
        id: "p10", obj: "contract #1 proof tape", act: "challenges land a few seconds apart", cam: "砸入", label: "300 ms",
        cues: (L) => [
          { at: 0, kind: "card", text: "Built for a fast chain", image: img("c1") },
          { at: L * 0.25, kind: "highlight", data: { rect: R.c1Policy } },
          { at: L * 0.5, kind: "number", text: "Monad block time", data: { value: 300, suffix: " ms", over: true } },
        ],
      },
      {
        id: "p10b", obj: "contract #4 proof rule", act: "thirty proofs, one every 15 s, in the terms", cam: "快推", label: "Default",
        cues: (L) => [
          { at: 0, kind: "card", text: "Cheap enough to be the default", image: img("c4") },
          { at: L * 0.35, kind: "highlight", text: "One proof every 15 s", data: { rect: R.c4Proof } },
        ],
      },
    ],
  },
  {
    voice: "pitch-live",
    shots: [
      {
        id: "p11", obj: "settlements table", act: "delivered, failed and disputed rows sit final", cam: "横移", label: "3 lifecycles",
        cues: (L) => [
          { at: 0, kind: "card", text: "Live on Monad testnet", image: img("settlements") },
          { at: L * 0.3, kind: "highlight", text: "3 lifecycles", data: { rect: R.stlTable } },
        ],
      },
      {
        id: "p12", obj: "collateral vault", act: "reconcile() accounts for every token", cam: "砸入", label: "69 tests",
        cues: (L) => [
          { at: 0, kind: "card", text: "Every token accounted for", image: img("liquidity") },
          { at: L * 0.2, kind: "highlight", text: "reconcile() OK", data: { rect: R.vault } },
          { at: L * 0.55, kind: "number", text: "Foundry tests pass", data: { value: 69, suffix: " / 69", over: true } },
        ],
      },
    ],
  },
  {
    voice: "pitch-why",
    shots: [
      {
        id: "p13", obj: "price protection curve", act: "the premium curve bends with the cover", cam: "快推", label: "Hedge",
        cues: (L) => [
          { at: 0, kind: "card", text: "Every commodity needs a hedge", image: img("protect") },
          { at: L * 0.35, kind: "highlight", text: "Compute is next", data: { rect: R.curve } },
        ],
      },
      {
        id: "p14", obj: "HYPERHEDGE landing page", act: "the camera settles on Launch App", cam: "快推", label: "",
        cues: (L) => [
          { at: 0, kind: "card", text: "HYPERHEDGE", sub: "hyperhedge-app.vercel.app", image: img("landing-hero") },
          { at: L * 0.4, kind: "highlight", text: "Launch App", data: { rect: R.heroCta } },
        ],
      },
    ],
  },
];

const AD: Scene[] = [
  {
    voice: "ad-hook",
    shots: [
      {
        id: "a01", obj: "contract #3 proof tape", act: "every cell stays empty, the host never answers", cam: "快推", label: "",
        cues: (L) => [
          { at: 0, kind: "card", image: img("c3") },
          { at: L * 0.3, kind: "highlight", text: "Never showed up", data: { rect: R.tape } },
        ],
      },
    ],
  },
  {
    voice: "ad-lock",
    shots: [
      {
        id: "a02", obj: "contract #4 collateral line", act: "900 hhUSD is locked before the sale", cam: "横移", label: "Locked",
        cues: (L) => [
          { at: 0, kind: "card", image: img("c4") },
          { at: L * 0.25, kind: "highlight", text: "Payout locked first", data: { rect: R.c4Collateral } },
        ],
      },
    ],
  },
  {
    voice: "ad-prove",
    shots: [
      {
        id: "a03", obj: "contract #1 proof tape", act: "twelve proofs fill in, one every 15 s", cam: "砸入", label: "15 s",
        cues: (L) => [
          { at: 0, kind: "card", image: img("c1") },
          { at: L * 0.15, kind: "highlight", text: "12 of 12 proven", data: { rect: R.tape } },
          { at: L * 0.5, kind: "number", text: "seconds per proof", data: { value: 15, suffix: " s", over: true } },
        ],
      },
    ],
  },
  {
    voice: "ad-pay",
    shots: [
      {
        id: "a04", obj: "settlements table", act: "the failed contract pays its buyers", cam: "砸入", label: "+110",
        cues: (L) => [
          { at: 0, kind: "card", image: img("settlements") },
          { at: L * 0.15, kind: "highlight", text: "Host failed", data: { rect: R.stlTable } },
          { at: L * 0.45, kind: "number", text: "to each buyer", data: { value: 110, suffix: " hhUSD", over: true } },
        ],
      },
    ],
  },
  {
    voice: "ad-end",
    shots: [
      {
        id: "a05", obj: "HYPERHEDGE landing page", act: "the camera lands on Launch App", cam: "快推", label: "",
        cues: (L) => [
          { at: 0, kind: "card", text: "Hedge your compute", sub: "hyperhedge-app.vercel.app", image: img("landing-hero") },
          { at: L * 0.35, kind: "highlight", text: "HYPERHEDGE", data: { rect: R.heroHead } },
        ],
      },
    ],
  },
];

const FILMS = { pitch: PITCH, ad: AD } as const;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const frames = (s: number) => Math.round(s * 30) / 30;

/** Splits each scene's narration length evenly across its shots, on whole frames. */
function plan(scenes: Scene[]) {
  const shots: { shot: Shot; len: number; scene: Scene; first: boolean }[] = [];
  const scenesOut: { voice: string; len: number }[] = [];
  for (const sc of scenes) {
    const total = frames((voice as Record<string, number>)[sc.voice]! + LEAD + TAIL);
    const each = frames(total / sc.shots.length);
    let used = 0;
    sc.shots.forEach((shot, i) => {
      const len = i === sc.shots.length - 1 ? frames(total - used) : each;
      used += len;
      shots.push({ shot, len: r3(len), scene: sc, first: i === 0 });
    });
    scenesOut.push({ voice: sc.voice, len: r3(total) });
  }
  return { shots, scenes: scenesOut };
}

function storyboard(name: string, scenes: Scene[]) {
  const { shots } = plan(scenes);
  let t = 0;
  const rows = shots.map(({ shot, len }) => {
    const a = r3(t);
    t += len;
    return `| ${a}–${r3(t)} | ${shot.obj} | ${shot.act} | ${shot.cam} | ${shot.label} | t2 片段 ${shot.id}.json |`;
  });
  return `画风：发布会式界面（t2_keynote_ui），HYPERHEDGE 真实产品截图满幅当主画面，焦点快推、数字砸入，全片一套
色板：#EEF3F8 #FFFFFF #0B1526 #46516A #1A54B0 #1F9D55
角色：无

| 时间段 | 画面里的物 | 它在做什么 | 镜头 | 屏上字 | 做法 |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
}

async function render(name: keyof typeof FILMS, only?: string, stills?: boolean) {
  const dir = join(OUT, name);
  const specs = join(ROOT, "specs", name);
  mkdirSync(dir, { recursive: true });
  mkdirSync(specs, { recursive: true });
  writeFileSync(join(ROOT, `${name}-storyboard.md`), storyboard(name, FILMS[name]));
  const { shots, scenes } = plan(FILMS[name]);

  for (const { shot, len } of shots) {
    if (only && shot.id !== only) continue;
    const spec = { grammar: "t2_keynote_ui", duration: len, fps: 30, width: 1920, height: 1080, theme: THEME, cues: shot.cues(len).map((c) => ({ ...c, at: r3(c.at), ...(c.kind === "number" && c.text ? { text: c.text.replaceAll(" ", " ") } : {}) })) };
    const sp = join(specs, `${shot.id}.json`);
    writeFileSync(sp, JSON.stringify(spec, null, 2));
    const args = stills ? ["--stills", [0.5, len * 0.5, len - 0.3].map((x) => x.toFixed(2)).join(","), "--out", join(dir, "stills", shot.id)] : ["--out", join(dir, `${shot.id}.mp4`)];
    console.log(`render ${shot.id} (${len}s)`);
    await $`uv run --with playwright python render.py --spec ${sp} ${args}`.cwd(ENGINE!).env({ ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" });
  }
  if (only || stills) return;

  // Join the shots with hard cuts, then lay each narration line LEAD seconds into its scene.
  const list = shots.map(({ shot }) => `file '${join(dir, `${shot.id}.mp4`).replaceAll("\\", "/")}'`).join("\n");
  writeFileSync(join(dir, "shots.txt"), list);
  const silent = join(dir, "silent.mp4");
  await $`ffmpeg -y -v error -f concat -safe 0 -i ${join(dir, "shots.txt")} -r 30 -c:v libx264 -crf 16 -pix_fmt yuv420p -an ${silent}`;

  const inputs: string[] = [];
  const parts: string[] = [];
  let at = 0;
  scenes.forEach((sc, i) => {
    inputs.push("-i", join(AUDIO, `${sc.voice}.mp3`));
    const ms = Math.round((at + LEAD) * 1000);
    parts.push(`[${i + 1}:a]adelay=${ms}|${ms}[v${i}]`);
    at += sc.len;
  });
  const mix = `${parts.join(";")};${scenes.map((_, i) => `[v${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0,apad[a]`;
  const final = join(OUT, `hyperhedge-${name}.mp4`);
  await $`ffmpeg -y -v error -i ${silent} ${inputs} -filter_complex ${mix} -map 0:v -map [a] -c:v copy -c:a aac -b:a 192k -shortest ${final}`;
  console.log(`done ${final} (${r3(at)}s)`);
}

const [which = "all", ...rest] = process.argv.slice(2);
const only = rest.includes("--only") ? rest[rest.indexOf("--only") + 1] : undefined;
const stills = rest.includes("--stills");
for (const n of which === "all" ? (["ad", "pitch"] as const) : [which as keyof typeof FILMS]) {
  if (!(n in FILMS)) throw new Error(`unknown film ${n}`);
  await render(n, only, stills);
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
