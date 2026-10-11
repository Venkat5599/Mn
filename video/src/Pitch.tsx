import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Caption, Mark, Rise, Shot, Stage, fade } from "./kit";
import { PITCH } from "./script";
import voice from "./voice.json";

export const FPS = 30;
const LEAD = 8; // frames of air before each line
const TAIL = 14; // frames of air after
export const sceneFrames = (prefix: string, id: string) => Math.ceil((voice as Record<string, number>)[`${prefix}-${id}`]! * FPS) + LEAD + TAIL;
export const pitchFrames = PITCH.reduce((n, s) => n + sceneFrames("pitch", s.id), 0);

const H: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 92, style }) => (
  <div style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.04, ...style }}>{children}</div>
);

const Team: React.FC<{ dur: number }> = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
    <Rise>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <Mark size={110} />
        <H size={120} style={{ fontWeight: 700, letterSpacing: "0.02em" }}>HYPERHEDGE</H>
      </div>
    </Rise>
    <Rise at={10}>
      <div style={{ fontSize: 40, color: C.ink2 }}>
        Built by <b style={{ color: C.ink, fontWeight: 500 }}>Venkat</b> · github.com/Venkat5599 · Monad Metropolis 2026
      </div>
    </Rise>
  </AbsoluteFill>
);

const Problem: React.FC<{ dur: number }> = ({ dur }) => {
  const lines = ["GPU capacity is prepaid.", "Providers under-deliver.", "The buyer eats the loss.", "No way to hedge it."];
  const step = (dur - LEAD) / lines.length;
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 180, gap: 18 }}>
      {lines.map((l, i) => {
        const on = f >= LEAD + i * step - 6;
        const last = i === lines.length - 1;
        return (
          <div key={l} style={{ opacity: on ? 1 : 0.14, transition: "none" }}>
            <H size={96} style={{ color: last && on ? C.blue : C.ink }}>{l}</H>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Solution: React.FC<{ dur: number }> = ({ dur }) => (
  <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 110px", gap: 70 }}>
    <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 26 }}>
      <Rise><H size={78}>Delivery risk, priced.</H></Rise>
      {[
        ["Buyer", "pays a premium per unit"],
        ["Seller", "locks the full payout first"],
        ["Result", "protection never goes unpaid"],
      ].map(([k, v], i) => (
        <Rise key={k} at={70 + i * 70}>
          <div style={{ fontSize: 38, color: C.ink2 }}>
            <b style={{ color: C.ink, fontWeight: 500 }}>{k}</b> {v}
          </div>
        </Rise>
      ))}
    </div>
    <Shot src="c4" dur={dur} focus={[0.78, 0.38]} from={1.55} to={1.75} w={1040} />
  </AbsoluteFill>
);

/** The proof tape from contract #1, drawn cell by cell with its real nonce prefixes. */
const Tape: React.FC<{ start: number; every: number }> = ({ start, every }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ids = ["cfeb", "0c3d", "725c", "814f", "e103", "f658", "0354", "533a", "eea0", "a0aa", "905b", "8496"];
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {ids.map((id, i) => {
        const p = spring({ frame: f - start - i * every, fps, config: { damping: 18, stiffness: 160 } });
        return (
          <div
            key={id}
            style={{
              width: 112,
              height: 92,
              borderRadius: 10,
              border: `2px solid ${p > 0.05 ? C.blue : "rgba(13,27,52,0.15)"}`,
              background: p > 0.05 ? `rgba(47,111,224,${0.18 + 0.7 * p})` : "transparent",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ opacity: p }}>{id}</span>
          </div>
        );
      })}
    </div>
  );
};

const Proof: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const counted = Math.min(12, Math.max(0, Math.floor((f - 60) / 22) + 1));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46 }}>
      <Rise><H size={84}>Delivery is proven, not claimed.</H></Rise>
      <Tape start={60} every={22} />
      <div style={{ display: "flex", gap: 70, fontSize: 34, color: C.ink2 }}>
        <span><b style={{ color: C.ink, fontWeight: 500 }}>seed</b> = fresh Monad block hash</span>
        <span><b style={{ color: C.ink, fontWeight: 500 }}>2²⁰</b> hashes per proof</span>
        <span><b style={{ color: C.ink, fontWeight: 500 }}>15 s</b> between challenges</span>
      </div>
      <div style={{ fontSize: 30, color: C.ink2 }}>
        Contract #1 on Monad testnet · <b style={{ color: C.good, fontWeight: 500 }}>{counted} of 12 proven</b>
      </div>
    </AbsoluteFill>
  );
};

const Settle: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const half = Math.floor(dur * 0.55);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {f < half ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, opacity: fade(f, half) }}>
          <Shot src="c2-verify" dur={half} focus={[0.27, 0.47]} from={1.35} to={1.6} w={1560} />
          <div style={{ fontSize: 34, color: C.ink2 }}>
            <b style={{ color: C.ink, fontWeight: 500 }}>Verify the evidence yourself:</b> every seed, proof and block hash, re-checked in the browser
          </div>
        </AbsoluteFill>
      ) : (
        <Sequence from={half} layout="none">
          <Flow />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

const Flow: React.FC = () => {
  const steps = [
    ["Seller disputes", "a valid failure", C.ink],
    ["Guardian upholds", "the signed report", C.ink],
    ["Bond slashed", "30 hhUSD to buyers", C.bad],
    ["Each buyer claims", "110 hhUSD", C.good],
  ] as const;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
      <Rise><div style={{ fontSize: 34, color: C.ink2 }}>Contract #3, three fresh wallets</div></Rise>
      <div style={{ display: "flex", gap: 22 }}>
        {steps.map(([a, b, c], i) => (
          <Rise key={a} at={8 + i * 16}>
            <div style={{ width: 360, padding: "30px 30px", borderRadius: 16, background: "#fff", border: "1px solid rgba(13,27,52,0.07)" }}>
              <div style={{ fontSize: 40, fontWeight: 500, color: c }}>{a}</div>
              <div style={{ fontSize: 30, color: C.ink2, marginTop: 8 }}>{b}</div>
            </div>
          </Rise>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Monad: React.FC<{ dur: number }> = () => {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [LEAD, 60], [12000, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 20 }}>
      <H size={220} style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
        {n.toLocaleString("en-US")}<span style={{ fontSize: 110, color: C.ink2 }}> ms</span>
      </H>
      <div style={{ fontSize: 42, color: C.ink2 }}>from 12-second blocks to Monad · a fresh challenge every few seconds is cheap</div>
    </AbsoluteFill>
  );
};

const Live: React.FC<{ dur: number }> = ({ dur }) => {
  const stats = [
    ["3", "lifecycles on testnet", "delivered · failed · disputed"],
    ["69 / 69", "Foundry tests pass", "unit · fuzz · invariants"],
    ["2 of 3", "signed reports", "EIP-712, replay-protected"],
    ["OK", "vault reconcile()", "every token accounted for"],
  ];
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 110px", gap: 60 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, width: 760 }}>
        {stats.map(([n, a, b], i) => (
          <Rise key={a} at={8 + i * 14}>
            <div style={{ padding: "26px 28px", borderRadius: 16, background: "#fff", border: "1px solid rgba(13,27,52,0.07)" }}>
              <div style={{ fontSize: 64, fontWeight: 500, letterSpacing: "-0.01em" }}>{n}</div>
              <div style={{ fontSize: 28, marginTop: 6 }}>{a}</div>
              <div style={{ fontSize: 22, color: C.ink2, marginTop: 4 }}>{b}</div>
            </div>
          </Rise>
        ))}
      </div>
      <Shot src="settlements" dur={dur} focus={[0.5, 0.3]} from={1} to={1.1} w={900} />
    </AbsoluteFill>
  );
};

const Why: React.FC<{ dur: number }> = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
    <Rise>
      <H size={84} style={{ textAlign: "center" }}>
        Every commodity needs a hedge.
        <br />
        <span style={{ color: C.blue }}>Compute is next.</span>
      </H>
    </Rise>
    <Rise at={150}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
        <Mark size={58} />
        <span style={{ fontSize: 54, fontWeight: 700, letterSpacing: "0.02em" }}>HYPERHEDGE</span>
      </div>
    </Rise>
    <Rise at={170}>
      <div style={{ fontSize: 32, color: C.ink2 }}>hyperhedge-app.vercel.app · github.com/Venkat5599/Mn</div>
    </Rise>
  </AbsoluteFill>
);

const VIEWS: Record<string, React.FC<{ dur: number }>> = {
  team: Team,
  problem: Problem,
  solution: Solution,
  proof: Proof,
  settle: Settle,
  monad: Monad,
  live: Live,
  why: Why,
};

export const Pitch: React.FC = () => {
  let at = 0;
  return (
    <Stage>
      {PITCH.map((s) => {
        const dur = sceneFrames("pitch", s.id);
        const from = at;
        at += dur;
        const View = VIEWS[s.id]!;
        return (
          <Sequence key={s.id} from={from} durationInFrames={dur}>
            <SceneFade dur={dur}>
              <View dur={dur} />
            </SceneFade>
            <Sequence from={LEAD} layout="none">
              <Audio src={staticFile(`audio/pitch-${s.id}.mp3`)} />
            </Sequence>
            <Caption text={s.say} dur={dur - LEAD - TAIL} lead={LEAD} />
          </Sequence>
        );
      })}
    </Stage>
  );
};

const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: fade(f, dur) }}>{children}</AbsoluteFill>;
};
