"use client";

import { STATE_LABEL, State, type State as StateT } from "@hyperhedge/sdk";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LitCard, Marquee, RiseWords, Settle, TiltWindow, Wordmark, useScrolled } from "@/components/LandingMotion";
import { Mark } from "@/components/Mark";
import { addrLink, deployment, txLink } from "@/lib/chain";
import { loadContracts, loadOracle, loadOracleContract, loadVault, usePoll } from "@/lib/data";
import { bytes32Label, short, usd } from "@/lib/format";
import { P8, loadPoolState } from "@/lib/pool";
import s from "./landing.module.css";

const NAV = [
  { href: "#top", label: "Home" },
  { href: "#product", label: "Product" },
  { href: "#proof", label: "Proofs" },
  { href: "#protect", label: "Price Protection" },
  { href: "#roles", label: "Who It's For" },
];

const Arrow = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Tick = ({ ok }: { ok: boolean | null }) =>
  ok === null ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={s.tickWait}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
    </svg>
  ) : ok ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={s.tickOk}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="m5 8.2 2 2 4-4.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={s.tickMiss}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="m5.5 5.5 5 5m0-5-5 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );

const SIDE = ["Markets", "Price Protection", "Portfolio", "Evidence Center", "Settlements"];

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const scrolled = useScrolled(40);
  const rows = usePoll(loadContracts, 12_000, []).data ?? [];
  const oracle = usePoll(loadOracle, 12_000, []).data ?? [];
  const vault = usePoll(loadVault, 15_000, []).data;
  const pool = usePoll(loadPoolState, 20_000, []).data;

  // The window shows the most recent contract the oracle actually challenged.
  const featuredId = useMemo(() => {
    const seen = oracle.filter((o) => o.issued > 0).sort((a, b) => Number(b.id) - Number(a.id));
    return seen[0]?.id;
  }, [oracle]);
  const featured = usePoll(() => (featuredId ? loadOracleContract(BigInt(featuredId)) : Promise.resolve(undefined)), 12_000, [featuredId]).data;
  const featuredRow = rows.find((r) => r.id.toString() === featuredId);

  const proofs = oracle.reduce((n, c) => n + c.answered, 0);
  const issued = oracle.reduce((n, c) => n + c.issued, 0);
  const settled = rows.filter((r) => r.status.state === State.SETTLED);
  const delivered = rows.filter((r) => r.status.state === State.DELIVERED || (r.status.state === State.EXPIRED && r.status.sold > 0n));
  const paidOut = settled.reduce((n, r) => n + BigInt(r.status.sold) * r.terms.payoutPerUnit, 0n);
  const live = rows.filter((r) => r.status.state === State.OPEN || r.status.state === State.ACTIVE);
  const challenges = featured?.challenges ?? [];
  const shown = challenges.slice(-6);
  const label = (st: number) => STATE_LABEL[st as StateT] ?? "Unknown";
  const reading = "reading…";

  return (
    <div className={s.page} id="top">
      {/* ── hero ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <header className={`${s.nav} ${scrolled ? s.navStuck : ""}`}>
          <Link href="/" className={s.logo}>
            <Mark size={22} />
            <span>HYPERHEDGE</span>
          </Link>
          <nav className={`${s.pill} ${menu ? s.pillOpen : ""}`} aria-label="Sections">
            {NAV.map((n, i) => (
              <a key={n.href} href={n.href} className={i === 0 ? s.pillOn : undefined} onClick={() => setMenu(false)}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className={s.navRight}>
            <Link href="/app" className={s.black}>
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
          <a href={addrLink(deployment.market)} target="_blank" rel="noreferrer" className={s.badge}>
            <Mark size={12} />
            Live on Monad testnet
            <Arrow size={10} />
          </a>
          <h1>
            <RiseWords text="Your GPU Hours." />
            <RiseWords text="Protected by Proof." delay={0.18} className={s.h1Two} />
          </h1>
          <p>Buy protection against reserved compute that never shows up. Collateral is locked onchain, delivery is proven by real work, and payouts settle on Monad.</p>
          <div className={s.ctas}>
            <Link href="/app" className={s.black}>
              Launch App <Arrow />
            </Link>
            <Link href="/app/faucet" className={s.white}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill="currentColor" />
              </svg>
              Get Test Funds
            </Link>
          </div>
        </div>

        {/* ── product window: live data ───────────────────── */}
        <TiltWindow className={s.window} id="product">
          <div className={s.winBar}>
            <i />
            <i />
            <i />
            <span>hyperhedge-app.vercel.app/app</span>
          </div>
          <div className={s.winBody}>
            <aside className={s.winSide}>
              <div className={s.winBrand}>
                <Mark size={16} />
                <b>HYPERHEDGE</b>
              </div>
              <p className={s.winGroup}>Trade</p>
              {SIDE.map((x, i) => (
                <span key={x} className={i === 0 ? s.winOn : undefined}>
                  {x}
                </span>
              ))}
              <p className={s.winGroup}>Open contracts</p>
              {live.slice(0, 3).map((r) => (
                <span key={r.id.toString()} className={s.winDot}>
                  #{r.id.toString()} {bytes32Label(r.terms.underlying)}
                </span>
              ))}
              {!live.length && <span className={s.winDot}>{rows.length ? "none open now" : reading}</span>}
            </aside>

            <div className={s.winMain}>
              <div className={s.ask}>
                <Mark size={26} />
                <div>
                  <b>Oracle</b>
                  <p>
                    {featuredRow
                      ? `Prove delivery of ${featuredRow.terms.quantity.toString()} ${bytes32Label(featuredRow.terms.underlying)} for contract #${featuredId}.`
                      : "Watching every contract on Monad testnet."}
                  </p>
                </div>
              </div>
              <div className={s.task}>
                <div className={s.taskHead}>
                  <div>
                    <b>Contract #{featuredId ?? "…"}</b>
                    <span>{featured?.sla?.computeClass ?? "delivery window"}</span>
                  </div>
                  <em className={featuredRow?.status.state === State.SETTLED ? s.emMiss : featuredRow?.status.state === State.DELIVERED || featuredRow?.status.state === State.EXPIRED ? s.emOk : undefined}>
                    {featuredRow ? (featuredRow.status.state === State.SETTLED ? "Failed, buyer paid" : label(featuredRow.status.state)) : reading}
                  </em>
                </div>
                <ul className={s.steps}>
                  <AnimatePresence initial={false}>
                  {shown.map((c) => {
                    const late = c.nonce === null && Date.now() > c.dueBy;
                    return (
                      <motion.li key={c.index} layout initial={{ y: -10 }} animate={{ y: 0 }} transition={{ duration: 0.45 }}>
                        <Tick ok={c.nonce !== null ? true : late ? false : null} />
                        <div>
                          <b>Challenge {c.index + 1}</b>
                          <span>
                            Block {c.blockNumber.toLocaleString("en-US")} ·{" "}
                            {c.answeredAt ? `answered in ${(c.answeredAt - c.issuedAt).toLocaleString("en-US")} ms` : late ? "no answer, counts as missed" : "waiting"}
                          </span>
                        </div>
                      </motion.li>
                    );
                  })}
                  </AnimatePresence>
                  {!shown.length && (
                    <li>
                      <Tick ok={null} />
                      <div>
                        <b>Loading challenges</b>
                        <span>from the oracle</span>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
              <div className={s.brief}>
                <b>Evidence</b>
                <span>
                  {featured?.evidenceHash
                    ? `keccak256 ${short(featured.evidenceHash, 6)} stored onchain with the report`
                    : `${featured?.answered ?? 0} of ${featured?.issued ?? 0} challenges answered so far`}
                </span>
              </div>
            </div>

            <aside className={s.winRight}>
              <p className={s.winGroup}>Locked collateral</p>
              <dl>
                <div>
                  <dt>Reserved for payouts</dt>
                  <dd>{vault ? usd(vault.reserved) : "…"}</dd>
                </div>
                <div>
                  <dt>Premiums held</dt>
                  <dd>{vault ? usd(vault.premium) : "…"}</dd>
                </div>
                <div>
                  <dt>Vault reconciles</dt>
                  <dd>{vault ? (vault.reconciled ? "Yes" : "No") : "…"}</dd>
                </div>
              </dl>
              <p className={s.winGroup}>Evidence policy</p>
              <ul className={s.policy}>
                <li>2 of 3 signers</li>
                <li>5 minute challenge window</li>
                <li>10% dispute bond</li>
              </ul>
            </aside>
          </div>
        </TiltWindow>
      </section>

      {/* ── built with ───────────────────────────────────── */}
      <section className={s.built}>
        <p>Built with open tools, settled on Monad testnet</p>
        <Marquee
          className={s.marquee}
          trackClass={s.track}
          items={["Monad", "Foundry", "OpenZeppelin", "viem", "wagmi", "RainbowKit", "Next.js", "EIP-712", "ERC-1155"]}
        />
      </section>

      {/* ── three blue cards ─────────────────────────────── */}
      <section className={s.section} id="proof">
        <a className={s.badge} href="#proof">
          <Mark size={12} />
          How it settles
        </a>
        <h2>
          Protection that knows your contract.
          <span> The right collateral, the right proof, the right payout.</span>
        </h2>
        <Settle className={s.cards3}>
          <figure>
            <LitCard className={s.blue}>
              <div className={s.inner}>
                <p className={s.innerHead}>Vault</p>
                <dl className={s.rows}>
                  <div>
                    <dt>Reserved</dt>
                    <dd>{vault ? usd(vault.reserved) : "…"}</dd>
                  </div>
                  <div>
                    <dt>Free</dt>
                    <dd>{vault ? usd(vault.free) : "…"}</dd>
                  </div>
                  <div>
                    <dt>Payable</dt>
                    <dd>{vault ? usd(vault.payable) : "…"}</dd>
                  </div>
                </dl>
                <span className={s.okLine}>{vault ? (vault.reconciled ? "Every token accounted for" : "Balance mismatch") : reading}</span>
              </div>
            </LitCard>
            <figcaption>
              <b>Collateral first</b>
              <span>A contract cannot exist until its full payout is locked in the vault.</span>
            </figcaption>
          </figure>
          <figure>
            <LitCard className={s.blue}>
              <div className={s.inner}>
                <p className={s.innerHead}>Proofs</p>
                <b className={s.big}>{proofs.toLocaleString("en-US")}</b>
                <span className={s.sub}>answered of {issued.toLocaleString("en-US")} challenges issued</span>
                <div className={s.bar}>
                  <i style={{ width: `${issued ? (proofs / issued) * 100 : 0}%` }} />
                </div>
              </div>
            </LitCard>
            <figcaption>
              <b>Proven by real compute</b>
              <span>Each challenge is seeded from a fresh Monad block, so no answer can be computed in advance.</span>
            </figcaption>
          </figure>
          <figure>
            <LitCard className={s.blue}>
              <div className={s.inner}>
                <p className={s.innerHead}>Settlement</p>
                <dl className={s.rows}>
                  <div>
                    <dt>Delivered</dt>
                    <dd>{rows.length ? delivered.length : "…"}</dd>
                  </div>
                  <div>
                    <dt>Failed, paid out</dt>
                    <dd>{rows.length ? settled.length : "…"}</dd>
                  </div>
                  <div>
                    <dt>hhUSD to buyers</dt>
                    <dd>{rows.length ? usd(paidOut) : "…"}</dd>
                  </div>
                </dl>
              </div>
            </LitCard>
            <figcaption>
              <b>Paid from collateral</b>
              <span>A verified failure pays the buyer onchain. Delivery returns collateral and premium to the seller.</span>
            </figcaption>
          </figure>
        </Settle>
      </section>

      {/* ── alternating feature rows ─────────────────────── */}
      <section className={s.features}>
        <Settle className={s.row}>
          <div className={s.copy}>
            <a className={s.badge} href="/app">
              <Mark size={12} />
              Markets
            </a>
            <h3>
              One place to buy, <span>sell and settle.</span>
            </h3>
            <p>Sellers lock collateral and set the terms. Buyers pay a premium per unit and hold a transferable position that pays out if delivery fails.</p>
          </div>
          <LitCard className={s.blue}>
            <div className={s.inner}>
              <p className={s.innerHead}>Open contracts</p>
              <ul className={s.list}>
                {(live.length ? live : rows).slice(0, 3).map((r) => (
                  <li key={r.id.toString()}>
                    <div>
                      <b>
                        #{r.id.toString()} {bytes32Label(r.terms.underlying)}
                      </b>
                      <span>
                        {r.status.sold.toString()} of {r.terms.units.toString()} units sold · {label(r.status.state)}
                      </span>
                    </div>
                    <em>{usd(r.terms.premiumPerUnit)} hhUSD</em>
                  </li>
                ))}
                {!rows.length && (
                  <li>
                    <div>
                      <b>{reading}</b>
                    </div>
                  </li>
                )}
              </ul>
              <Link href="/app" className={s.blackSm}>
                Browse markets <Arrow size={10} />
              </Link>
            </div>
          </LitCard>
        </Settle>

        <Settle className={`${s.row} ${s.flip}`}>
          <div className={s.copy}>
            <a className={s.badge} href="/app/evidence">
              <Mark size={12} />
              Evidence
            </a>
            <h3>
              Every proof, <span>checkable in your browser.</span>
            </h3>
            <p>The evidence file holds every seed, nonce and block. Its hash is stored onchain, and the app re-checks each proof against Monad.</p>
          </div>
          <LitCard className={s.blue}>
            <div className={s.inner}>
              <p className={s.innerHead}>Verify contract #{featuredId ?? "…"}</p>
              <ul className={s.list}>
                <li>
                  <Tick ok={featured ? true : null} />
                  <div>
                    <b>Seeds re-derived</b>
                    <span>from block hashes</span>
                  </div>
                </li>
                <li>
                  <Tick ok={featured ? true : null} />
                  <div>
                    <b>Proofs re-hashed</b>
                    <span>one sha256 each</span>
                  </div>
                </li>
                <li>
                  <Tick ok={featured?.reportTx ? true : null} />
                  <div>
                    <b>Report on Monad</b>
                    <span>
                      {featured?.reportTx ? (
                        <a href={txLink(featured.reportTx)} target="_blank" rel="noreferrer">
                          {short(featured.reportTx)}
                        </a>
                      ) : (
                        "after the deadline"
                      )}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </LitCard>
        </Settle>

        <Settle className={s.row} id="protect">
          <div className={s.copy}>
            <a className={s.badge} href="/app/protect">
              <Mark size={12} />
              Price protection
            </a>
            <h3>
              Hedge a falling <span>MON price too.</span>
            </h3>
            <p>An AMM sells protection below a strike you choose. Liquidity providers lock the full payout for every position it sells.</p>
          </div>
          <LitCard className={s.blue}>
            <div className={s.inner}>
              <p className={s.innerHead}>MON/USD pool</p>
              <dl className={s.rows}>
                <div>
                  <dt>Pool assets</dt>
                  <dd>{pool ? usd(pool.assets) : "…"}</dd>
                </div>
                <div>
                  <dt>Locked for payouts</dt>
                  <dd>{pool ? usd(pool.locked) : "…"}</dd>
                </div>
                <div>
                  <dt>Positions sold</dt>
                  <dd>{pool ? pool.positions.length : "…"}</dd>
                </div>
                <div>
                  <dt>Last spot</dt>
                  <dd>{pool?.positions[0] ? `$${(Number(pool.positions[0].spot) / P8).toFixed(4)}` : "…"}</dd>
                </div>
              </dl>
              <Link href="/app/protect" className={s.blackSm}>
                Get a quote <Arrow size={10} />
              </Link>
            </div>
          </LitCard>
        </Settle>
      </section>

      {/* ── dark band ────────────────────────────────────── */}
      <section className={s.dark} id="roles">
        <a className={`${s.badge} ${s.badgeDark}`} href="#roles">
          <Mark size={12} />
          Who it&apos;s for
        </a>
        <h2>
          Built for the risk compute buyers <span>actually carry.</span>
        </h2>
        <p className={s.darkLead}>Three parties, one contract, and no support ticket deciding who is owed what.</p>
        <div className={s.roles}>
          {[
            ["The buyer", "Pays a premium per unit. If the host fails to prove delivery, the full payout comes from locked collateral."],
            ["The seller", "Locks the whole maximum payout to sell protection, and earns the premium when delivery is proven."],
            ["The host", "Runs a small agent that answers proof-of-work challenges for the whole delivery window."],
          ].map(([t, d], i) => (
            <Settle key={t} className={s.role} delay={i * 0.09}>
              <span className={s.roleNum}>0{i + 1}</span>
              <b>{t}</b>
              <p>{d}</p>
            </Settle>
          ))}
        </div>
        <Link href="/app" className={s.whiteSolid}>
          Launch App <Arrow />
        </Link>
      </section>

      {/* ── footer: the dark floor continues ─────────────── */}
      <footer className={s.footer}>
        <div className={s.footTop}>
          <div className={s.footBrand}>
            <Link href="/" className={s.footLogo}>
              <Mark size={22} />
              <span>HYPERHEDGE</span>
            </Link>
            <p>Protection against GPU compute that is not delivered. Collateral locked onchain, delivery proven by real work, payouts settled on Monad.</p>
            <dl className={s.footStats}>
              <div>
                <dt>Contracts</dt>
                <dd>{rows.length || "…"}</dd>
              </div>
              <div>
                <dt>Proofs answered</dt>
                <dd>{oracle.length ? proofs.toLocaleString("en-US") : "…"}</dd>
              </div>
              <div>
                <dt>Vault</dt>
                <dd>{vault ? (vault.reconciled ? "Reconciles" : "Mismatch") : "…"}</dd>
              </div>
            </dl>
          </div>
          <nav className={s.footCols} aria-label="Footer">
            <div>
              <p>Trade</p>
              <Link href="/app">Markets</Link>
              <Link href="/app/protect">Price Protection</Link>
              <Link href="/app/secondary">Secondary Market</Link>
              <Link href="/app/issue">Issue a Contract</Link>
            </div>
            <div>
              <p>Verify</p>
              <Link href="/app/evidence">Evidence Center</Link>
              <Link href="/app/settlements">Settlements</Link>
              <Link href="/app/activity">Activity Log</Link>
              <Link href="/app/risk">Risk Engine</Link>
            </div>
            <div>
              <p>Contracts</p>
              {(
                [
                  ["Market", deployment.market],
                  ["Vault", deployment.vault],
                  ["Oracle", deployment.oracle],
                  ["hhUSD", deployment.token],
                ] as const
              ).map(([n, a]) => (
                <a key={n} href={addrLink(a)} target="_blank" rel="noreferrer">
                  {n} <span className="mono">{short(a)}</span>
                </a>
              ))}
            </div>
            <div>
              <p>Project</p>
              <a href="https://github.com/Venkat5599/Mn" target="_blank" rel="noreferrer">
                GitHub <Arrow size={10} />
              </a>
              <Link href="/app/developers">Developer Portal</Link>
              <Link href="/app/faucet">Test Funds</Link>
              <Link href="/app/status">Status</Link>
            </div>
          </nav>
        </div>
        <div className={s.footBar}>
          <span>Monad Metropolis 2026 · testnet only · unaudited · settled in a test token with no value</span>
          <a href="#top">
            Back to top
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <Wordmark text="HYPERHEDGE" className={s.wordmark} />
      </footer>
    </div>
  );
}
