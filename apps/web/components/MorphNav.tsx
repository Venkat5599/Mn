"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import type { Icon } from "@phosphor-icons/react";
import { Mark } from "./Mark";
import s from "./MorphNav.module.css";

export type MorphLink = { href: string; label: string; icon: Icon };

type Props = {
  links: MorphLink[];
  cta: { href: string; label: string; icon: Icon };
};

const SPRING = { type: "spring", stiffness: 300, damping: 28, mass: 0.8 } as const;

/** Which in-page section is under the nav: the last one whose top has passed the bar. */
function useActive(links: MorphLink[]) {
  const [active, setActive] = useState(links[0]?.href);
  useEffect(() => {
    const ids = links.map((l) => l.href).filter((h) => h.startsWith("#") && h !== "#top");
    const f = () => {
      let on = links[0]?.href;
      for (const id of ids) {
        const el = document.querySelector(id);
        if (el && el.getBoundingClientRect().top <= 140) on = id;
      }
      setActive(on);
    };
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [links]);
  return active;
}

/**
 * Morphing header, ported from Scrappy's MorphNav: a full bar at the top of the page that springs into a
 * floating icon pill once the page scrolls. Always rendered and visible; only its shape changes.
 */
export function MorphNav({ links, cta }: Props) {
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));
  useEffect(() => setScrolled(window.scrollY > 40), []);
  const active = useActive(links);

  return (
    <div className={s.wrap}>
      <motion.nav
        layout={!reduce}
        transition={SPRING}
        aria-label="Main"
        className={`${s.nav} ${scrolled ? s.small : s.full}`}
        style={{ borderRadius: scrolled ? 28 : 22 }}
      >
        <Link href="/" className={s.brand} aria-label="HYPERHEDGE home">
          <motion.span layout={!reduce ? "position" : false} transition={SPRING} className={s.brandIn}>
            <Mark size={scrolled ? 20 : 22} />
            <span className={s.word}>HYPERHEDGE</span>
          </motion.span>
        </Link>

        <ul className={s.links}>
          {links.map(({ href, label, icon: I }) => {
            const on = active === href;
            return (
              <li key={href}>
                <a href={href} aria-current={on ? "location" : undefined} title={label} className={`${s.link} ${on ? s.on : ""}`}>
                  {on && (
                    <motion.span
                      layoutId="morph-nav-active"
                      transition={SPRING}
                      className={s.lit}
                      style={{ borderRadius: scrolled ? 20 : 12 }}
                    />
                  )}
                  <span className={s.linkIn}>{scrolled ? <I size={20} weight={on ? "fill" : "bold"} /> : label}</span>
                  {scrolled && <span className={s.sr}>{label}</span>}
                </a>
              </li>
            );
          })}
        </ul>

        <Link href={cta.href} className={s.cta} title={cta.label}>
          {!scrolled && <span>{cta.label}</span>}
          <cta.icon size={18} weight="bold" className={s.ctaIcon} />
          {scrolled && <span className={s.sr}>{cta.label}</span>}
        </Link>
      </motion.nav>
    </div>
  );
}
