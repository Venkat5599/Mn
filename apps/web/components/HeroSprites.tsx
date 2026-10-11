"use client";

import { useEffect, useState } from "react";
import { FINN, SPRITES } from "./spriteData";

/**
 * The hero's decorative pixel sprites. They are raw SVG markup, so they mount after hydration: the browser
 * re-serializes inline SVG differently from the server string, which would otherwise fail hydration.
 * Purely decorative (aria-hidden), so nothing readable waits on this.
 */
export function HeroSprites({ wrap, sprite, float }: { wrap: string; sprite: string; float: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <div aria-hidden="true" className={wrap} />;
  return (
    <div aria-hidden="true" className={wrap}>
      {SPRITES.map((p, i) => (
        <div key={i} className={sprite} style={{ top: `${p.top}%`, left: `${p.left}%`, width: p.width }}>
          <div
            className={float}
            style={{ rotate: `${p.rotate}deg`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
            dangerouslySetInnerHTML={{ __html: p.svg }}
          />
        </div>
      ))}
    </div>
  );
}

export function Finn({ className }: { className: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return <div className={className} role="img" aria-label="Finn the fish" dangerouslySetInnerHTML={on ? { __html: FINN } : undefined} />;
}
