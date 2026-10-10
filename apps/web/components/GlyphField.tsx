"use client";

import { useEffect, useRef } from "react";

/**
 * A ridge of small glyph bars rising from the bottom edge, drawn on a canvas. Decorative only:
 * it never carries content, and with reduced motion it renders once and stays still.
 */
export function GlyphField({ className, peaks = [[0.5, 0.95, 0.22], [0.22, 0.55, 0.14], [0.8, 0.6, 0.16]] }: { className?: string; peaks?: number[][] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GLYPHS = ["|", "ı", ":", "!", "·", "|", "ǀ"];
    let cells: { x: number; y: number; g: string; a: number }[] = [];
    let raf = 0;
    let last = 0;

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = 9;
      const rh = 12;
      cells = [];
      for (let x = 0; x < w; x += cw) {
        const fx = x / w;
        let ridge = 0;
        for (const [cx, height, spread] of peaks) ridge = Math.max(ridge, height! * Math.exp(-((fx - cx!) ** 2) / (2 * spread! ** 2)));
        const top = h - ridge * h;
        for (let y = h - rh / 2; y > top; y -= rh) {
          const depth = (y - top) / (h - top + 1);
          if (Math.random() > 0.55 + depth * 0.4) continue;
          cells.push({ x, y, g: GLYPHS[(Math.random() * GLYPHS.length) | 0]!, a: 0.25 + Math.random() * 0.6 * (1 - depth * 0.5) });
        }
      }
    };

    const draw = (t: number) => {
      if (t - last > 120) {
        last = t;
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "center";
        for (const c of cells) {
          if (!reduce && Math.random() < 0.015) c.a = 0.2 + Math.random() * 0.75;
          ctx.fillStyle = `rgba(232, 240, 235, ${c.a})`;
          ctx.fillText(c.g, c.x, c.y);
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    build();
    draw(1_000);
    if (!reduce) raf = requestAnimationFrame(draw);
    const onResize = () => {
      build();
      draw(performance.now() + 1_000);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [peaks]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
