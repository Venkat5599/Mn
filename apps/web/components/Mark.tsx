/**
 * The HYPERHEDGE mark: two posts (the obligation and the collateral) joined by a hedge line that cuts
 * across them on a diagonal. Drawn bare, no tile behind it.
 */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 3v18M19 3v18" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M3.5 15.5 20.5 8.5" stroke="var(--cyan)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
