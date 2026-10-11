import Link from "next/link";
import s from "./Button.module.css";

type Common = { children: React.ReactNode; className?: string; arrow?: boolean; tone?: "ink" | "light" };

/** Up-and-out arrow: the one arrow the landing uses on every action. */
export function Arrow({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={`${s.arrow} ${className ?? ""}`}>
      <path d="M4.5 11.5l7-7M6 4.5h5.5V10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const cls = (tone: Common["tone"], className = "") => `${s.btn} ${tone === "light" ? s.light : ""} ${className}`;

/** Solid action: no glow, no lift. State changes by tone; the arrow travels. */
export function Button({ children, className, arrow, tone, ...rest }: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cls(tone, className)}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function LinkButton({ href, children, className, arrow = true, tone }: Common & { href: string }) {
  return (
    <Link href={href} className={cls(tone, className)}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}
