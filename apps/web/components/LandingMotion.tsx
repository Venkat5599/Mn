"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Landing motion. Every piece moves content that is already on screen: nothing starts at opacity 0, so a
 * stalled animation, a background tab or a screenshot still shows the whole page.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Words rise into place on load. Position only; each word is readable at its starting offset. */
export function RiseWords({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          style={{ display: "inline-block", marginRight: "0.24em" }}
          initial={reduce ? false : { y: "0.42em", rotate: 2.5 }}
          animate={{ y: 0, rotate: 0 }}
          transition={{ duration: 0.9, delay: delay + i * 0.07, ease: EASE }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

/** The product window leans back in 3D and flattens as it scrolls toward the reader. */
export function TiltWindow({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 30%"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  const rotateX = useTransform(p, [0, 1], [16, 0]);
  const scale = useTransform(p, [0, 1], [0.93, 1]);
  const y = useTransform(p, [0, 1], [40, 0]);
  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
        ref={ref}
        id={id}
        className={className}
        style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 0%" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Settles a block upward as it enters the viewport. Opacity never changes. */
export function Settle({ children, className, delay = 0, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      id={id}
      initial={reduce ? false : { y: 48 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** A blue card lit by the pointer, with its white panel drifting against the scroll. */
export function LitCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [26, -26]);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} className={className} onPointerMove={reduce ? undefined : move} data-lit="">
      <motion.div style={reduce ? undefined : { y, width: "100%", display: "grid", placeItems: "center" }}>{children}</motion.div>
    </div>
  );
}

/** True once the page has scrolled past `px`. */
export function useScrolled(px = 24) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(window.scrollY > px);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [px]);
  return on;
}

/** A row that scrolls forever: two identical tracks, the second hidden from assistive tech. */
export function Marquee({ items, className, trackClass }: { items: string[]; className?: string; trackClass?: string }) {
  return (
    <div className={className}>
      {[0, 1].map((k) => (
        <div key={k} className={trackClass} aria-hidden={k === 1 ? true : undefined}>
          {items.map((n) => (
            <b key={n}>{n}</b>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The footer wordmark: a light follows the pointer across the letters. */
export function Wordmark({ text, className }: { text: string; className?: string }) {
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--wx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--wy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div className={className} onPointerMove={move} aria-hidden="true">
      <span>{text}</span>
    </div>
  );
}
