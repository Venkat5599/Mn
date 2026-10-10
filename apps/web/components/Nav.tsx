"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { short } from "@/lib/format";
import { Mark } from "./Mark";
import { useWallet } from "./Wallet";
import s from "./Nav.module.css";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/issue", label: "Issue" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/faucet", label: "Test funds" },
];

function Bar() {
  const path = usePathname();
  const { account, connect, connecting, error } = useWallet();
  return (
    <header className={s.bar}>
      <div className={`wrap ${s.inner}`}>
        <Link href="/" className={s.brand} aria-label="HYPERHEDGE home">
          <Mark size={22} />
          <span>HYPERHEDGE</span>
        </Link>
        <nav className={s.links}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? s.active : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className={s.right}>
          <span className={s.net}>Monad testnet</span>
          {account ? (
            <span className={`mono ${s.acct}`}>{short(account)}</span>
          ) : (
            <button className="btn quiet" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
      {error ? <p className={`wrap ${s.err}`}>{error}</p> : null}
    </header>
  );
}

export const Nav = Bar;
