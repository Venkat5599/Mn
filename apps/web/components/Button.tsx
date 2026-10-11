import Link from "next/link";
import s from "./Button.module.css";

type Tone = "primary" | "secondary";
type Common = { children: React.ReactNode; className?: string; arrow?: boolean; tone?: Tone };

/** Up-and-out arrow, drawn to match the button's weight. */
export function Arrow({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={`${s.arrow} ${className ?? ""}`}>
      <path d="M4.5 11.5l7-7M6 4.5h5.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const cls = (tone: Tone = "primary", className = "") => `${s.btn} ${tone === "secondary" ? s.secondary : s.primary} ${className}`;

/** Solid action: flat fill, no glow, no lift. Hover shifts tone; the arrow travels. */
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
