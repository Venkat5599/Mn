"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addrLink, deployment } from "@/lib/chain";
import { loadVault, usePoll } from "@/lib/data";
import { short } from "@/lib/format";
import { Mark } from "./Mark";
import { useWallet } from "./Wallet";
import s from "./Sidebar.module.css";

const NAV = [
  { href: "/app", label: "Markets", match: (p: string) => p === "/app" || p.startsWith("/app/c/") },
  { href: "/app/issue", label: "Issue protection", match: (p: string) => p === "/app/issue" },
  { href: "/app/portfolio", label: "Portfolio", match: (p: string) => p === "/app/portfolio" },
  { href: "/app/faucet", label: "Test funds", match: (p: string) => p === "/app/faucet" },
];

export function Sidebar() {
  const path = usePathname();
  const { account, connect, connecting, error } = useWallet();
  const vault = usePoll(loadVault, 10_000, []);

  return (
    <aside className={s.side}>
      <Link href="/" className={s.brand} aria-label="HYPERHEDGE home">
        <Mark size={22} />
        <span>HYPERHEDGE</span>
      </Link>

      <nav className={s.nav} aria-label="Dashboard">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={n.match(path) ? s.active : undefined} aria-current={n.match(path) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>

      <div className={s.foot}>
        <dl className={s.facts}>
          <div>
            <dt>Network</dt>
            <dd>Monad testnet</dd>
          </div>
          <div>
            <dt>Vault</dt>
            <dd className={vault.data ? (vault.data.reconciled ? s.ok : s.bad) : undefined}>
              {vault.data ? (vault.data.reconciled ? "reconciles" : "mismatch") : "…"}
            </dd>
          </div>
          <div>
            <dt>Market</dt>
            <dd>
              <a href={addrLink(deployment.market)} target="_blank" rel="noreferrer" className="mono">
                {short(deployment.market)}
              </a>
            </dd>
          </div>
        </dl>
        {account ? (
          <p className={`mono ${s.acct}`}>{short(account, 6)}</p>
        ) : (
          <button className="btn" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting" : "Connect wallet"}
          </button>
        )}
        {error ? <p className={s.err}>{error}</p> : null}
      </div>
    </aside>
  );
}
