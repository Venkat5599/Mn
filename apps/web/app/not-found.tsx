"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Mark } from "@/components/Mark";
import s from "./not-found.module.css";

function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = (c.width = c.clientWidth);
    const h = (c.height = c.clientHeight);
    // a drifting cloud of points, densest along a diagonal band
    const pts = Array.from({ length: 2600 }, () => {
      const t = Math.random();
      const spread = (Math.random() - 0.5) * (0.35 + Math.random() * 0.3);
      return { x: w * (0.15 + t * 0.7) + spread * w * 0.25, y: h * (0.75 - t * 0.45) + spread * h, v: Math.random() * 0.4 + 0.1, a: Math.random() };
    });
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) p.x += p.v * 0.15;
        if (p.x > w) p.x = 0;
        ctx.fillStyle = `rgba(111, 207, 159, ${0.12 + p.a * 0.45})`;
        ctx.fillRect(p.x, p.y, 1.4, 1.4);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className={s.particles} aria-hidden="true" />;
}

export default function NotFound() {
  return (
    <div className={s.frame}>
      <section className={s.panel}>
        <header className={s.nav}>
          <Link href="/" className={s.logo}>
            <Mark size={24} />
            <span>
              hyper<b>hedge</b>
            </span>
          </Link>
          <Link href="/app" className={s.white}>
            Launch App ↗
          </Link>
        </header>
        <Particles />
        <div className={s.body}>
          <p className={s.code}>404</p>
          <p className={s.msg}>Something went wrong!</p>
          <Link href="/" className={s.white}>
            Back to Home ↗
          </Link>
        </div>
      </section>
    </div>
  );
}
