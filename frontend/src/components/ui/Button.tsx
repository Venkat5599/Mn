import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "chalk" | "quiet";
  busy?: boolean;
  wide?: boolean;
}

export function Button({ tone = "chalk", busy, wide, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.btn, styles[tone], wide ? styles.wide : "", className ?? ""].join(" ")}
    >
      {busy ? <span className={styles.dots} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
