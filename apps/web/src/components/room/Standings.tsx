import type { Address } from "viem";
import type { Standing } from "@/hooks/use-room";
import styles from "./Standings.module.css";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Season table: chips carry across games, so the stack IS the standing. */
export function Standings({
  rows,
  me,
  host,
  format,
}: {
  rows: Standing[];
  me?: Address;
  host: Address;
  format: (v: bigint) => string;
}) {
  if (rows.length === 0) return <p className={styles.empty}>Nobody has joined yet. Send the link.</p>;
  const lower = me?.toLowerCase();
  return (
    <ol className={styles.table}>
      {rows.map((r, i) => {
        const isMe = r.address.toLowerCase() === lower;
        return (
          <li key={r.address} className={styles.row} data-me={isMe || undefined}>
            <span className={`${styles.rank} num`}>{i + 1}</span>
            <span className={styles.who}>
              <span className={styles.addr}>{isMe ? "You" : short(r.address)}</span>
              {r.address.toLowerCase() === host.toLowerCase() && <span className={styles.note}>host</span>}
            </span>
            <span className={`${styles.chips} num`}>{format(r.chips)}</span>
          </li>
        );
      })}
    </ol>
  );
}
