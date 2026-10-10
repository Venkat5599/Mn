"use client";

import { State } from "@hyperhedge/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { addrLink, deployment } from "@/lib/chain";
import { loadContracts, usePoll } from "@/lib/data";
import { Mark } from "./Mark";
import s from "./Sidebar.module.css";

const I = {
  markets: "M3 17V9m6 8V5m6 12v-6m6 6V3",
  issue: "M12 5v14M5 12h14",
  portfolio: "M4 7h16v12H4zM9 7V5h6v2",
  funds: "M12 3v18M7 8h7a3 3 0 0 1 0 6H8",
  contracts: "M6 3h9l4 4v14H6zM14 3v5h5",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4",
  docs: "M5 4h10l4 4v12H5zM9 12h6M9 16h6",
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const rows = usePoll(loadContracts, 8_000, []).data ?? [];
  const open = rows.filter((r) => r.status.state === State.OPEN || r.status.state === State.ACTIVE).length;

  const pages = [
    { href: "/app", label: "Markets", icon: I.markets, count: rows.length, on: path === "/app" || path.startsWith("/app/c/") },
    { href: "/app/issue", label: "Issue", icon: I.issue, count: undefined, on: path === "/app/issue" },
    { href: "/app/portfolio", label: "Portfolio", icon: I.portfolio, count: undefined, on: path === "/app/portfolio" },
    { href: "/app/faucet", label: "Test funds", icon: I.funds, count: undefined, on: path === "/app/faucet" },
  ];
  const protocol = [
    { href: addrLink(deployment.market), label: "Contracts", icon: I.contracts },
    { href: "https://github.com/Venkat5599/Mn", label: "Source", icon: I.code },
    { href: "https://github.com/Venkat5599/Mn/blob/main/docs/FINANCIAL_MODEL.md", label: "Financial model", icon: I.docs },
  ];

  return (
    <aside className={s.side}>
      <div className={s.brandRow}>
        <Link href="/" className={s.brand} aria-label="HYPERHEDGE home">
          <Mark size={26} />
          <span>HYPERHEDGE</span>
        </Link>
      </div>

      <p className={s.group}>Pages</p>
      <nav className={s.nav} aria-label="Pages">
        {pages.map((n) => (
          <Link key={n.href} href={n.href} className={n.on ? s.active : undefined} aria-current={n.on ? "page" : undefined}>
            <Icon d={n.icon} />
            <span className={s.label}>{n.label}</span>
            {n.count !== undefined ? <span className={s.count}>{n.label === "Markets" ? open || n.count : n.count}</span> : null}
            <svg className={s.chev} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </Link>
        ))}
      </nav>

      <p className={s.group}>Protocol</p>
      <nav className={s.nav} aria-label="Protocol">
        {protocol.map((n) => (
          <a key={n.href} href={n.href} target="_blank" rel="noreferrer">
            <Icon d={n.icon} />
            <span className={s.label}>{n.label}</span>
            <svg className={s.chev} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </a>
        ))}
      </nav>

      <p className={s.foot}>Monad testnet · unaudited · test token</p>
    </aside>
  );
}
