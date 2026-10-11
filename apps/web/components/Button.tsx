import Link from "next/link";
import s from "./Button.module.css";

type Common = { children: React.ReactNode; className?: string; arrow?: boolean };

/** Up-and-out arrow, drawn to match the button's weight. */
export function Arrow({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" className={`${s.arrow} ${className ?? ""}`}>
      <path d="M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" />
    </svg>
  );
}

/** The glossy pill from the scrappypet landing: a drifting blue surface, a soft top shine, the label above both. */
function Inner({ children, arrow }: { children: React.ReactNode; arrow?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className={s.surface} />
      <span aria-hidden="true" className={s.shine} />
      <span className={s.label}>
        {children}
        {arrow && <Arrow />}
      </span>
    </>
  );
}

export function Button({ children, className = "", arrow, ...rest }: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${s.btn} ${className}`}>
      <Inner arrow={arrow}>{children}</Inner>
    </button>
  );
}

export function LinkButton({ href, children, className = "", arrow = true, download }: Common & { href: string; download?: boolean }) {
  return (
    <Link href={href} className={`${s.btn} ${className}`} download={download}>
      <Inner arrow={arrow}>{children}</Inner>
    </Link>
  );
}
