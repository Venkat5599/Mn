"use client";

import { State } from "@hyperhedge/sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadContracts, usePoll } from "@/lib/data";
import { Mark } from "./Mark";
import s from "./Sidebar.module.css";

const I = {
  markets: "M3 17V9m6 8V5m6 12v-6m6 6V3",
  shield: "M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7z",
  swap: "M7 7h13l-4-4M17 17H4l4 4",
  issue: "M12 5v14M5 12h14",
  portfolio: "M4 7h16v12H4zM9 7V5h6v2",
  server: "M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01",
  sim: "M4 19 9 12l4 4 7-10",
  evidence: "M9 12l2 2 4-4M5 4h14v16H5z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  log: "M4 6h16M4 12h16M4 18h10",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  gauge: "M4 16a8 8 0 1 1 16 0M12 16l4-5",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4",
  funds: "M12 3v18M7 8h7a3 3 0 0 1 0 6H8",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
};

type Item = { href: string; label: string; icon: string; count?: number };

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const rows = usePoll(loadContracts, 15_000, []).data ?? [];
  const open = rows.filter((r) => r.status.state === State.OPEN || r.status.state === State.ACTIVE).length;
  const settled = rows.filter((r) => r.status.state >= State.DELIVERED).length;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Trade",
      items: [
        { href: "/app", label: "Markets", icon: I.markets, count: open || rows.length },
        { href: "/app/protect", label: "Price Protection", icon: I.shield },
        { href: "/app/secondary", label: "Secondary Market", icon: I.swap },
        { href: "/app/issue", label: "Issue Contract", icon: I.issue },
      ],
    },
    {
      title: "Manage",
      items: [
        { href: "/app/portfolio", label: "Portfolio", icon: I.portfolio },
        { href: "/app/providers", label: "Provider Registry", icon: I.server },
        { href: "/app/simulator", label: "Strategy Simulator", icon: I.sim },
      ],
    },
    {
      title: "Verify",
      items: [
        { href: "/app/evidence", label: "Evidence Center", icon: I.evidence },
        { href: "/app/settlements", label: "Settlements & Claims", icon: I.receipt, count: settled },
        { href: "/app/activity", label: "Activity & Audit Log", icon: I.log },
      ],
    },
    {
      title: "Protocol",
      items: [
        { href: "/app/liquidity", label: "Liquidity & Collateral", icon: I.drop },
        { href: "/app/risk", label: "Risk Engine", icon: I.gauge },
        { href: "/app/analytics", label: "Protocol Analytics", icon: I.chart },
      ],
    },
    { title: "Develop", items: [{ href: "/app/developers", label: "Developer Portal", icon: I.code }] },
    {
      title: "Utilities",
      items: [
        { href: "/app/faucet", label: "Test Funds", icon: I.funds },
        { href: "/app/status", label: "Alerts & Monitoring", icon: I.bell },
        { href: "/app/settings", label: "Settings", icon: I.gear },
      ],
    },
  ];

  const isOn = (href: string) => (href === "/app" ? path === "/app" || path.startsWith("/app/c/") : path === href);

  // Phones get a compact bar; the grouped list opens under it and closes on navigation.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);

  return (
    <aside className={s.side} data-open={menuOpen || undefined}>
      <div className={s.brandRow}>
        <Link href="/" className={s.brand} aria-label="HYPERHEDGE home">
          <Mark size={26} />
          <span>HYPERHEDGE</span>
        </Link>
        <button type="button" className={s.menu} aria-expanded={menuOpen} aria-controls="app-nav" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>
      <div id="app-nav" className={s.groups}>
      {groups.map((g) => (
        <div key={g.title} className={s.groupBlock}>
          <p className={s.group}>{g.title}</p>
          <nav className={s.nav} aria-label={g.title}>
            {g.items.map((n) => {
              const on = isOn(n.href);
              return (
                <Link key={n.href} href={n.href} className={on ? s.active : undefined} aria-current={on ? "page" : undefined}>
                  <Icon d={n.icon} />
                  <span className={s.label}>{n.label}</span>
                  {n.count ? <span className={s.count}>{n.count}</span> : null}
                  <svg className={s.chev} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
      </div>
      <p className={s.foot}>Monad testnet · unaudited · test token</p>
    </aside>
  );
}
