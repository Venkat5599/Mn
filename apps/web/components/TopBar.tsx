"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import s from "./TopBar.module.css";

/** Search filters the markets list by contract number or underlying, through the `q` URL parameter. */
export function TopBar() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  return (
    <header className={s.bar}>
      <form
        className={s.search}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q ? `/app?q=${encodeURIComponent(q)}` : "/app");
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (path === "/app") router.replace(e.target.value ? `/app?q=${encodeURIComponent(e.target.value)}` : "/app");
          }}
          placeholder="Search contracts by number or underlying"
          aria-label="Search contracts"
        />
      </form>
      <div className={s.right}>
        <span className={s.net}>
          <i />
          Monad testnet
        </span>
        <ConnectButton chainStatus="none" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} />
      </div>
    </header>
  );
}
