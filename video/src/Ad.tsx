import React from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Mark, Rise, Shot, Stage, fade } from "./kit";
import { AD } from "./script";
import voice from "./voice.json";

const FPS = 30;
const LEAD = 6;
const TAIL = 26;
export const adScene = (id: string) => Math.ceil((voice as Record<string, number>)[`ad-${id}`]! * FPS) + LEAD + TAIL;
export const adFrames = AD.reduce((n, s) => n + adScene(s.id), 0);

const Big: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.ink }) => (
  <div style={{ fontSize: 120, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.02, textAlign: "center", color }}>{children}</div>
);

const Cells: React.FC<{ filled: boolean }> = ({ filled }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {Array.from({ length: 10 }, (_, i) => {
        const p = filled ? spring({ frame: f - 6 - i * 5, fps, config: { damping: 16, stiffness: 180 } }) : 0;
        return (
          <div
            key={i}
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              border: `2px solid ${filled ? C.blue : C.bad}`,
              background: filled ? `rgba(47,111,224,${0.15 + 0.75 * p})` : "rgba(224,86,106,0.08)",
              transform: `scale(${0.9 + 0.1 * (filled ? p : 1)})`,
            }}
          />
        );
      })}
    </div>
  );
};

const Hook = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
    <Rise><Big>Paid for GPUs that<br />never showed up?</Big></Rise>
    <Cells filled={false} />
  </AbsoluteFill>
);

const Lock = ({ dur }: { dur: number }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
    <Rise><Big>Payout <span style={{ color: C.blue }}>locked</span> before you buy.</Big></Rise>
    <Shot src="c4" dur={dur} focus={[0.7, 0.62]} from={1.5} to={1.7} w={1200} />
  </AbsoluteFill>
);

const Prove = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
    <Rise><Big>Proven every 15 seconds.</Big></Rise>
    <Cells filled />
    <div style={{ fontSize: 40, color: C.ink2 }}>seeded by fresh Monad blocks</div>
  </AbsoluteFill>
);

const Pay = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div style={{ fontSize: 60, color: C.ink2 }}>Host fails?</div>
      <div style={{ transform: `scale(${0.85 + 0.15 * p})` }}>
        <Big color={C.good}>+110 hhUSD</Big>
      </div>
      <div style={{ fontSize: 40, color: C.ink2 }}>paid from locked collateral, onchain</div>
    </AbsoluteFill>
  );
};

const End = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
    <Rise>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Mark size={120} />
        <span style={{ fontSize: 128, fontWeight: 700, letterSpacing: "0.02em" }}>HYPERHEDGE</span>
      </div>
    </Rise>
    <Rise at={8}><div style={{ fontSize: 56 }}>Hedge your compute.</div></Rise>
    <Rise at={16}><div style={{ fontSize: 34, color: C.ink2 }}>hyperhedge-app.vercel.app · live on Monad testnet</div></Rise>
  </AbsoluteFill>
);

const VIEWS: Record<string, React.FC<{ dur: number }>> = { hook: Hook, lock: Lock, prove: Prove, pay: Pay, end: End };

export const Ad: React.FC = () => {
  let at = 0;
  return (
    <Stage>
      {AD.map((s) => {
        const dur = adScene(s.id);
        const from = at;
        at += dur;
        const View = VIEWS[s.id]!;
        return (
          <Sequence key={s.id} from={from} durationInFrames={dur}>
            <Fade dur={dur} last={s.id === "end"}>
              <View dur={dur} />
            </Fade>
            <Sequence from={LEAD} layout="none">
              <Audio src={staticFile(`audio/ad-${s.id}.mp3`)} />
            </Sequence>
          </Sequence>
        );
      })}
    </Stage>
  );
};

const Fade: React.FC<{ dur: number; last: boolean; children: React.ReactNode }> = ({ dur, last, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: last ? Math.min(1, f / 6) : fade(f, dur) }}>{children}</AbsoluteFill>;
};
