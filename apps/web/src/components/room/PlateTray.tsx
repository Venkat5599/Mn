import styles from "./PlateTray.module.css";

/** The bet tray, cut as home plate: flat front edge, point toward the catcher. */
export function PlateTray({ children }: { children: React.ReactNode }) {
  return <section className={styles.tray}>{children}</section>;
}
