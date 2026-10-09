import Link from "next/link";
import styles from "./Wordmark.module.css";

/** Home plate seen from above, drawn as the brand mark. */
export function PlateMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.mark}>
      <path d="M3.5 4.5h17v8.2L12 20.5l-8.5-7.8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.wordmark} aria-label="Pitchside home">
      <PlateMark />
      <span>PITCHSIDE</span>
    </Link>
  );
}
