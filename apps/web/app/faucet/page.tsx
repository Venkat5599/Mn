"use client";

import { TxStatus } from "@/components/TxStatus";
import { useTx, useWallet } from "@/components/Wallet";
import { addrLink, deployment, pub, tokenAbi } from "@/lib/chain";
import { usePoll } from "@/lib/data";
import { relative, short, usd } from "@/lib/format";
import s from "../form.module.css";

export default function Faucet() {
  const { account, connect } = useWallet();
  const tx = useTx();
  const info = usePoll(
    async () => {
      if (!account) return undefined;
      const [bal, last, mon] = await Promise.all([
        pub.readContract({ address: deployment.token, abi: tokenAbi, functionName: "balanceOf", args: [account] }),
        pub.readContract({ address: deployment.token, abi: tokenAbi, functionName: "lastDrip", args: [account] }),
        pub.getBalance({ address: account }),
      ]);
      return { bal, next: last === 0n ? 0 : Number(last) + 3600, mon };
    },
    4_000,
    [account],
  );
  const now = Date.now() / 1000;
  const ready = info.data ? info.data.next <= now : false;

  return (
    <main className={`wrap ${s.main}`}>
      <header className={s.head}>
        <h1>Test funds</h1>
        <p className="muted">
          HYPERHEDGE runs on Monad testnet. You need a little MON for gas and some hhUSD, a test token with no value, to buy or sell protection.
        </p>
      </header>

      <section className={`panel ${s.summary}`}>
        <h2>1 · MON for gas</h2>
        <p>
          Get testnet MON from the official faucet at{" "}
          <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
            faucet.monad.xyz
          </a>
          . A few tenths of a MON covers dozens of transactions.
          {info.data ? (
            <>
              {" "}
              You have <b className="num">{(Number(info.data.mon) / 1e18).toFixed(3)}</b> MON.
            </>
          ) : null}
        </p>
      </section>

      <section className={`panel ${s.summary}`}>
        <h2>2 · hhUSD to trade with</h2>
        <p>
          1,000 hhUSD per request, once an hour per address, minted by{" "}
          <a href={addrLink(deployment.token)} target="_blank" rel="noreferrer" className="mono">
            {short(deployment.token)}
          </a>
          .{info.data ? <> Your balance: <b className="num">{usd(info.data.bal)}</b> hhUSD.</> : null}
        </p>
        {account ? (
          <button
            className="btn"
            disabled={!ready || tx.state.phase === "signing" || tx.state.phase === "pending"}
            onClick={() => tx.run([{ label: "Request 1,000 hhUSD", request: { address: deployment.token, abi: tokenAbi, functionName: "faucet" } }])}
          >
            {ready || !info.data ? "Request 1,000 hhUSD" : `Available again ${relative(info.data.next, now)}`}
          </button>
        ) : (
          <button className="btn" onClick={connect}>
            Connect wallet
          </button>
        )}
        <TxStatus state={tx.state} />
      </section>
    </main>
  );
}
