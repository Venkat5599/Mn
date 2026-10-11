import React from "react";
import { AbsoluteFill, Img, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** The landing page's palette: cool paper, navy ink, one blue. */
export const C = {
  paper: "#eef3f8",
  paper2: "#f8fafc",
  ink: "#0d1b34",
  ink2: "#4a5872",
  blue: "#2f6fe0",
  good: "#2fae7f",
  bad: "#e0566a",
};

export const FONT = "Supreme, system-ui, sans-serif";

export const Fonts: React.FC = () => (
  <style>{[400, 500, 700]
    .map((w) => `@font-face{font-family:Supreme;src:url(${staticFile(`fonts/Supreme-${w}.woff2`)}) format("woff2");font-weight:${w};}`)
    .join("")}</style>
);

/** Soft directional light on the paper, plus fine grain, so the frame never sits on a flat fill. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.paper2} 0%, ${C.paper} 55%, #e3ebf4 100%)`, fontFamily: FONT, color: C.ink }}>
    <Fonts />
    {children}
    <AbsoluteFill
      style={{
        opacity: 0.05,
        mixBlendMode: "multiply",
        pointerEvents: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  </AbsoluteFill>
);

export const Mark: React.FC<{ size: number; ink?: string }> = ({ size, ink = C.ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 3v18M19 3v18" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M3.5 15.5 20.5 8.5" stroke={C.blue} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** Rises into place. Content is never hidden: it starts 70% visible and only moves 24px. */
export const Rise: React.FC<{ at?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at = 0, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: 18 });
  return <div style={{ transform: `translateY(${(1 - p) * 24}px)`, opacity: 0.7 + 0.3 * p, ...style }}>{children}</div>;
};

/** A real screenshot of the live app, framed and slowly pushed in toward a focus point. */
export const Shot: React.FC<{
  src: string;
  focus?: [number, number]; // 0..1 of the image
  from?: number;
  to?: number;
  dur: number;
  w?: number;
  style?: React.CSSProperties;
}> = ({ src, focus = [0.5, 0.4], from = 1, to = 1.12, dur, w = 1500, style }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [from, to], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const h = (w * 1080) / 1920;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 2px 3px rgba(13,27,52,0.08), 0 18px 40px -24px rgba(13,27,52,0.35)",
        border: "1px solid rgba(13,27,52,0.06)",
        background: "#fff",
        ...style,
      }}
    >
      <Img
        src={staticFile(`shots/${src}.png`)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%` }}
      />
    </div>
  );
};

/** The narration as a quiet caption line, advancing sentence by sentence in proportion to its length. */
export const Caption: React.FC<{ text: string; dur: number; lead: number }> = ({ text, dur, lead }) => {
  const f = useCurrentFrame() - lead;
  const parts = text.match(/[^.?!:]+[.?!:]?/g)!.map((s) => s.trim()).filter(Boolean);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let acc = 0;
  let line = parts[0]!;
  for (const p of parts) {
    if (f >= (acc / total) * dur) line = p;
    acc += p.length;
  }
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1400, padding: "10px 22px", borderRadius: 12, background: "rgba(13,27,52,0.82)", color: "#f4f7fb", fontSize: 30, lineHeight: 1.35, textAlign: "center" }}>
        {line}
      </div>
    </div>
  );
};


export const fade = (f: number, dur: number) =>
  interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
