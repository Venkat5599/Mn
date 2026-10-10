"use client";

import Link from "next/link";
import { useState } from "react";
import { GlyphField } from "@/components/GlyphField";
import { Mark } from "@/components/Mark";
import { addrLink, deployment } from "@/lib/chain";
import { loadContracts, loadOracle, loadVault, usePoll } from "@/lib/data";
import { short, usd } from "@/lib/format";
import s from "./landing.module.css";

const NAV = [
  { href: "#top", label: "Home" },
  { href: "#about", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#protocol", label: "Protocol" },
  { href: "#settlement", label: "Settlement" },
];

const Arrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Chip = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <span className={`${s.chip} ${light ? s.chipLight : ""}`}>
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1.5 9V5M5 9V1M8.5 9V3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const rows = usePoll(loadContracts, 10_000, []).data ?? [];
  const oracle = usePoll(loadOracle, 10_000, []).data ?? [];
  const vault = usePoll(loadVault, 15_000, []).data;
  const proofs = oracle.reduce((n, c) => n + c.answered, 0);
  const settledPayout = rows.filter((r) => r.status.state === 6).reduce((n, r) => n + r.status.sold * r.terms.payoutPerUnit, 0n);

  return (
    <div className={s.frame} id="top">
      {/* ── hero ───────────────────────────────────────────── */}
      <section className={s.hero}>
        <header className={s.nav}>
          <Link href="/" className={s.logo}>
            <Mark size={24} />
            <span>
              hyper<b>hedge</b>
            </span>
          </Link>
          <nav className={`${s.pill} ${menu ? s.pillOpen : ""}`}>
            {NAV.map((n, i) => (
              <a key={n.href} href={n.href} className={i === 0 ? s.pillOn : undefined} onClick={() => setMenu(false)}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className={s.navRight}>
            <Link href="/app/faucet" className={s.ghostLink}>
              Test Funds <Arrow />
            </Link>
            <Link href="/app" className={s.white}>
              Launch App <Arrow />
            </Link>
            <button className={s.burger} onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
              <i />
              <i />
              <i />
            </button>
          </div>
        </header>

        <div className={s.heroBody}>
          <Chip>Live on Monad Testnet</Chip>
          <h1>
            Insure the GPU Hours
            <br />
            You Already Paid For
          </h1>
          <p>Delivery protection for reserved compute: collateral locked onchain, delivery proven by real work, payouts settled on Monad.</p>
          <div className={s.ctas}>
            <Link href="/app" className={s.white}>
              Open App
            </Link>
            <Link href="/app" className={s.green}>
              Explore Markets <Arrow />
            </Link>
          </div>
        </div>

        {[12, 23, 41, 63, 77, 88].map((l, i) => (
          <span key={l} className={s.streak} style={{ left: `${l}%`, top: `${14 + ((i * 17) % 40)}%`, animationDelay: `${i * 0.7}s` }} />
        ))}
        <GlyphField className={s.glyphs} peaks={[[0.5, 0.82, 0.2], [0.18, 0.5, 0.13], [0.82, 0.55, 0.15]]} />
      </section>

      {/* ── about (light) ──────────────────────────────────── */}
      <section className={s.light} id="about">
        <div className={s.head}>
          <Chip light>About HYPERHEDGE</Chip>
          <h2>
            Built for Compute Buyers.
            <br />
            Settled on Monad.
          </h2>
          <p>Focused on collateral, verifiable delivery and onchain settlement</p>
        </div>
        <div className={s.cards3}>
          <article className={`${s.card} ${s.cardTexture}`}>
            <h3>
              Collateral
              <br />
              First
            </h3>
            <p>A contract cannot exist until its full maximum payout is locked in the vault.</p>
            <Link href="/app/issue" className={s.white}>
              Issue Protection
            </Link>
          </article>
          <article className={`${s.card} ${s.cardSilk}`}>
            <h3>
              Proven by
              <br />
              Real Compute
            </h3>
            <p>The host answers block-seeded proof-of-work challenges through the whole delivery window.</p>
            <Link href="/app" className={s.white}>
              See the Proofs
            </Link>
          </article>
          <article className={`${s.card} ${s.cardDark}`}>
            <span className={s.cardLabel}>Proofs Verified</span>
            <b className={s.bigNum}>{proofs.toLocaleString("en-US")}</b>
            <p>Each one millions of hashes on the seller&apos;s machine, checked against Monad blocks.</p>
          </article>
        </div>
      </section>

      {/* ── how it works (dark) ────────────────────────────── */}
      <section className={s.dark} id="how">
        <div className={s.head}>
          <Chip>How It Works</Chip>
          <h2>
            A Clear Rule to Settle
            <br />
            Every Delivery
          </h2>
          <p>Four parties, one contract, and no support ticket deciding who is owed what</p>
        </div>
        <div className={s.glass3}>
          <article className={s.glass}>
            <span className={s.orb}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>The Buyer</h3>
            <p>Pays a premium per unit. If the host fails to prove delivery, the buyer receives the full payout from locked collateral.</p>
            <GlyphField className={s.glassGlyph} peaks={[[0.5, 0.9, 0.35]]} />
          </article>
          <article className={s.glass}>
            <span className={s.orb}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 10h16v10H4zM8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>The Seller</h3>
            <p>Locks the whole maximum payout to sell protection, and earns the premium when delivery is proven.</p>
            <GlyphField className={s.glassGlyph} peaks={[[0.3, 0.8, 0.25], [0.8, 0.6, 0.2]]} />
          </article>
          <article className={s.glass}>
            <span className={s.orb}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>Core Guarantees</h3>
            <ul className={s.checks}>
              <li>
                <b>Fully collateralized</b>: coverage never exceeds what is locked.
              </li>
              <li>
                <b>2-of-3 signed evidence</b>: bound to this chain and contract.
              </li>
              <li>
                <b>Bonded disputes</b>: a wrong challenger pays the other side.
              </li>
              <li>
                <b>Missing data never pays</b>: no report means the seller is released.
              </li>
            </ul>
          </article>
        </div>
        <div className={s.built}>
          <span>Built With</span>
          <div>
            {["Monad", "Foundry", "OpenZeppelin", "viem", "RainbowKit", "Next.js"].map((n) => (
              <b key={n}>{n}</b>
            ))}
          </div>
        </div>
      </section>

      {/* ── protocol snapshot (light) ──────────────────────── */}
      <section className={`${s.light} ${s.split}`} id="protocol">
        <div className={s.splitCopy}>
          <Chip light>Protocol</Chip>
          <h2>
            Verified by Proofs,
            <br />
            Not by Promises
          </h2>
          <a href={addrLink(deployment.market)} target="_blank" rel="noreferrer" className={s.black}>
            View Contracts <Arrow />
          </a>
          <p className={s.splitFoot}>
            Every challenge seed comes from a fresh Monad block, so a host cannot precompute answers. The evidence file&apos;s hash is stored
            onchain with the report, and the app re-checks every proof, seed and block in your browser.
          </p>
        </div>
        <div className={s.render}>
          <div className={s.snapshot}>
            <span className={s.orb}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
              </svg>
            </span>
            <h3>Protocol Snapshot</h3>
            <ul>
              <li>Network: Monad Testnet (10143)</li>
              <li>
                Market: <span className="mono">{short(deployment.market)}</span>
              </li>
              <li>Evidence: 2 of 3 Signers</li>
              <li>Challenge Window: 5 Minutes</li>
              <li>Dispute Bond: 10% of Payout</li>
            </ul>
            <p>Collateral checked onchain: {vault ? (vault.reconciled ? "every token accounted for" : "mismatch") : "reading…"}</p>
          </div>
        </div>
      </section>

      {/* ── counter (light) ────────────────────────────────── */}
      <section className={`${s.light} ${s.counter}`} id="settlement">
        <div className={s.head}>
          <Chip light>Settlement</Chip>
          <h2>
            Built on Collateral.
            <br />
            Settled for Certainty.
          </h2>
        </div>
        <div className={s.outlineNum}>
          <span>{usd(settledPayout || 0n)}</span>
          <i className={`${s.float} ${s.f1}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10h16v10H4zM8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </i>
          <i className={`${s.float} ${s.f2}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </i>
        </div>
        <p className={s.counterNote}>hhUSD paid to buyers by verified delivery failures on Monad testnet. Every payout is traceable to a signed, recountable report.</p>
        <Link href="/app" className={s.black}>
          Open App Safely
        </Link>
      </section>

      <footer className={s.footer}>
        <Link href="/" className={s.logo}>
          <Mark size={22} />
          <span>
            hyper<b>hedge</b>
          </span>
        </Link>
        <p>Built on Monad for Metropolis 2026 · testnet only · unaudited · settled in a test token with no value</p>
        <nav>
          <Link href="/app">App</Link>
          <a href="https://github.com/Venkat5599/Mn" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={addrLink(deployment.market)} target="_blank" rel="noreferrer">
            Contracts
          </a>
        </nav>
      </footer>
    </div>
  );
}
