"use client";

import { ORACLE_API, pub } from "@/lib/chain";
import { loadOracle, loadVault, usePoll } from "@/lib/data";
import { loadEvents, loadSignedPrice } from "@/lib/pool";
import s from "../pages.module.css";

async function check() {
  const t0 = Date.now();
  const [block, health, price, vault, oracle, events] = await Promise.allSettled([
    pub.getBlock({ blockTag: "latest" }),
    fetch(`${ORACLE_API}/health`, { cache: "no-store" }).then((r) => r.json() as Promise<{ ok: boolean; signers: string[] }>),
    loadSignedPrice(),
    loadVault(),
    loadOracle(),
    loadEvents(undefined, 1),
  ]);
  const now = Date.now() / 1000;
  const items: { name: string; state: "ok" | "warn" | "bad"; detail: string }[] = [];
  if (block.status === "fulfilled") {
    const lag = now - Number(block.value.timestamp);
    items.push({ name: "Monad RPC", state: Math.abs(lag) < 120 ? "ok" : "warn", detail: `block ${block.value.number} · ${Date.now() - t0} ms` });
  } else items.push({ name: "Monad RPC", state: "bad", detail: "no response" });
  items.push(
    health.status === "fulfilled" && health.value.ok
      ? { name: "Oracle service", state: "ok", detail: `${health.value.signers.length} signing keys loaded` }
      : { name: "Oracle service", state: "bad", detail: "not responding" },
  );
  if (price.status === "fulfilled") {
    const age = Math.abs(now - price.value.report.publishTime);
    items.push({ name: "MON/USD price feed", state: age < 60 ? "ok" : age < 300 ? "warn" : "bad", detail: `last signed ${Math.round(age)} s ago` });
  } else items.push({ name: "MON/USD price feed", state: "bad", detail: "no signed price" });
  items.push(
    vault.status === "fulfilled"
      ? { name: "Vault accounting", state: vault.value.reconciled ? "ok" : "bad", detail: vault.value.reconciled ? "reconcile() holds" : "reconcile() mismatch" }
      : { name: "Vault accounting", state: "bad", detail: "unreadable" },
  );
  if (oracle.status === "fulfilled") {
    const abstained = oracle.value.filter((o) => o.abstained).length;
    items.push({ name: "Delivery challenges", state: abstained ? "warn" : "ok", detail: `${oracle.value.length} contracts tracked${abstained ? `, ${abstained} abstained` : ""}` });
  }
  items.push(
    events.status === "fulfilled"
      ? { name: "Event index", state: "ok", detail: `${events.value.total} events indexed` }
      : { name: "Event index", state: "bad", detail: "unavailable" },
  );
  return { items, at: Date.now() };
}

export default function Status() {
  const st = usePoll(check, 15_000, []);
  const bad = st.data?.items.filter((i) => i.state === "bad").length ?? 0;
  const warn = st.data?.items.filter((i) => i.state === "warn").length ?? 0;
  return (
    <main className={s.main}>
      <header className={s.head}>
        <h1>Alerts &amp; Monitoring</h1>
        <p>Live health of every moving part, checked from your browser every 15 seconds.</p>
      </header>
      <section className={`panel ${s.card}`}>
        <h2 className={bad ? s.bad : warn ? s.warn : s.ok}>{!st.data ? "Checking…" : bad ? `${bad} problem${bad > 1 ? "s" : ""}` : warn ? `${warn} warning${warn > 1 ? "s" : ""}` : "All systems working"}</h2>
        <ul className={s.list}>
          {(st.data?.items ?? []).map((i) => (
            <li key={i.name}>
              <span>
                <b className={i.state === "ok" ? s.ok : i.state === "warn" ? s.warn : s.bad}>●</b> {i.name}
              </span>
              <span className={s.mute}>{i.detail}</span>
            </li>
          ))}
        </ul>
        {st.data ? <p className={s.mute}>Last checked {new Date(st.data.at).toLocaleTimeString("en-GB")}</p> : null}
      </section>
    </main>
  );
}
