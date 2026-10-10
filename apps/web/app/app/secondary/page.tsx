"use client";

import { STATE_LABEL, State, positionListingsAbi } from "@hyperhedge/sdk";
import Link from "next/link";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { addrLink, deployment, pub, tokenAbi } from "@/lib/chain";
import { loadContracts, marketContract, usePoll } from "@/lib/data";
import { bytes32Label, relative, short, usd } from "@/lib/format";
import s from "../pages.module.css";

const BOOK = (process.env.NEXT_PUBLIC_LISTINGS ?? "0x3203EEEB9F675cF818856727172120c33147a68E") as Address;
const book = { address: BOOK, abi: positionListingsAbi } as const;
const USD = 1_000_000;

async function loadBook() {
  const [next, rows] = await Promise.all([pub.readContract({ ...book, functionName: "nextListing" }), loadContracts()]);
  const ids = Array.from({ length: Number(next) - 1 }, (_, i) => BigInt(i + 1));
  const listings = await Promise.all(ids.map(async (lid) => ({ lid, ...(await pub.readContract({ ...book, functionName: "listing", args: [lid] })) })));
  return { listings: listings.reverse(), rows };
}

export default function Secondary() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const data = usePoll(loadBook, 10_000, []);
  const mine = usePoll(
    async () => {
      if (!account || !data.data) return { held: [] as { id: bigint; units: bigint }[], approved: false };
      const held = await Promise.all(data.data.rows.map(async (r) => ({ id: r.id, units: await pub.readContract({ ...marketContract, functionName: "balanceOf", args: [account, r.id] }) })));
      const approved = await pub.readContract({ ...marketContract, functionName: "isApprovedForAll", args: [account, BOOK] });
      return { held: held.filter((h) => h.units > 0n), approved };
    },
    10_000,
    [account, data.data?.rows.length],
  );
  const [fillUnits, setFillUnits] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ id: "", units: "1", price: "", hours: "24" });
  const [to, setTo] = useState("");

  const now = Date.now() / 1000;
  const rowOf = (id: bigint) => data.data?.rows.find((r) => r.id === id);
  const live = (data.data?.listings ?? []).filter((l) => !l.cancelled && l.filled < l.units && Number(l.expiresAt) > now);
  const myListings = (data.data?.listings ?? []).filter((l) => account && l.seller.toLowerCase() === account.toLowerCase() && !l.cancelled && l.filled < l.units);

  const fill = (lid: bigint, units: bigint, price: bigint) =>
    tx.run([
      { label: "Approve hhUSD for the order book", request: { address: deployment.token, abi: tokenAbi, functionName: "approve", args: [BOOK, units * price] } },
      { label: `Buy ${units} unit${units > 1n ? "s" : ""} from listing #${lid}`, request: { ...book, functionName: "fill", args: [lid, units] } },
    ]);

  const listIt = () => {
    const price = BigInt(Math.round(+form.price * USD));
    const steps = [];
    if (!mine.data?.approved) steps.push({ label: "Allow the order book to move your positions", request: { ...marketContract, functionName: "setApprovalForAll", args: [BOOK, true] } });
    steps.push({
      label: "List position",
      request: { ...book, functionName: "list", args: [BigInt(form.id), BigInt(form.units), price, BigInt(Math.floor(now + +form.hours * 3600))] },
    });
    return tx.run(steps);
  };

  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Secondary Market</h1>
        <p>
          Buy and sell protection that is already issued. A fill pays the holder and moves the position, with its right to claim, in one
          transaction. Positions stay in the holder&apos;s wallet until someone fills, so listing locks nothing.{" "}
          <a href={addrLink(BOOK)} target="_blank" rel="noreferrer" className="mono">
            Order book {short(BOOK)}
          </a>
        </p>
      </header>

      <section className={`panel ${s.card}`}>
        <h2>Open listings</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Contract</th>
                <th>State</th>
                <th>Units left</th>
                <th>Price / unit</th>
                <th>Pays on failure / unit</th>
                <th>Expires</th>
                <th>Buy</th>
              </tr>
            </thead>
            <tbody>
              {live.map((l) => {
                const r = rowOf(l.id);
                const left = l.units - l.filled;
                const n = BigInt(Math.max(1, Math.min(Number(left), Math.floor(+(fillUnits[l.lid.toString()] ?? "1") || 1))));
                const own = account && l.seller.toLowerCase() === account.toLowerCase();
                return (
                  <tr key={l.lid.toString()}>
                    <td className="num">#{l.lid.toString()}</td>
                    <td>
                      <Link href={`/app/c/${l.id}`}>
                        #{l.id.toString()} {r ? bytes32Label(r.terms.underlying) : ""}
                      </Link>
                    </td>
                    <td>{r ? STATE_LABEL[r.status.state as State] : "…"}</td>
                    <td className="num">{left.toString()}</td>
                    <td className="num">{usd(l.pricePerUnit)}</td>
                    <td className="num">{r ? usd(r.terms.payoutPerUnit) : "…"}</td>
                    <td className="num">{relative(l.expiresAt, now)}</td>
                    <td>
                      {own ? (
                        <span className={s.mute}>yours</span>
                      ) : account ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input style={{ width: 64 }} value={fillUnits[l.lid.toString()] ?? "1"} onChange={(e) => setFillUnits({ ...fillUnits, [l.lid.toString()]: e.target.value })} />
                          <button className="btn" onClick={() => fill(l.lid, n, l.pricePerUnit)}>
                            Buy {usd(n * l.pricePerUnit)}
                          </button>
                        </div>
                      ) : (
                        <button className="btn quiet" onClick={connect}>
                          Connect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!live.length ? <p className={s.mute}>{data.error ?? "No open listings. List a position below to start the book."}</p> : null}
        <TxStatus state={tx.state} />
      </section>

      <div className={s.two}>
        <section className={`panel ${s.card}`}>
          <h2>Sell a position</h2>
          {!account ? (
            <button className="btn" onClick={connect} style={{ justifySelf: "start" }}>
              Connect wallet
            </button>
          ) : mine.data?.held.length ? (
            <>
              <div className={s.row}>
                <label>
                  Position
                  <select value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}>
                    <option value="">Choose…</option>
                    {mine.data.held.map((h) => (
                      <option key={h.id.toString()} value={h.id.toString()}>
                        #{h.id.toString()} · you hold {h.units.toString()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Units
                  <input value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
                </label>
              </div>
              <div className={s.row}>
                <label>
                  Price per unit (hhUSD)
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 12" />
                </label>
                <label>
                  Listing lasts (hours)
                  <input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                </label>
              </div>
              <button className="btn" style={{ justifySelf: "start" }} disabled={!form.id || !(+form.price > 0) || !(+form.units > 0)} onClick={listIt}>
                {mine.data.approved ? "List position" : "Approve and list"}
              </button>
            </>
          ) : (
            <p className={s.mute}>You do not hold any protection yet. Buy some on Markets, then list it here.</p>
          )}
          {myListings.length ? (
            <>
              <h2>Your listings</h2>
              <ul className={s.list}>
                {myListings.map((l) => (
                  <li key={l.lid.toString()}>
                    <span>
                      #{l.lid.toString()} · contract {l.id.toString()} · {(l.units - l.filled).toString()} left at {usd(l.pricePerUnit)}
                    </span>
                    <button className="btn quiet" onClick={() => tx.run([{ label: `Cancel listing #${l.lid}`, request: { ...book, functionName: "cancel", args: [l.lid] } }])}>
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className={`panel ${s.card}`}>
          <h2>Or transfer directly</h2>
          <p className={s.mute}>For a deal agreed elsewhere: send units to any address. The claim right moves with them.</p>
          <label>
            Recipient address
            <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" />
          </label>
          {account && mine.data?.held.length ? (
            <ul className={s.list}>
              {mine.data.held.map((h) => (
                <li key={h.id.toString()}>
                  <span>
                    #{h.id.toString()} · {h.units.toString()} units
                  </span>
                  <button
                    className="btn quiet"
                    disabled={!isAddress(to)}
                    onClick={() => tx.run([{ label: `Transfer #${h.id}`, request: { ...marketContract, functionName: "safeTransferFrom", args: [account, to as Address, h.id, h.units, "0x"] } }])}
                  >
                    Send all
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
