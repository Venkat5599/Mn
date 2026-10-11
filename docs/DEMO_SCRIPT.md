# Demo and pitch scripts

**Before recording:**
- Use a fresh browser profile with MetaMask and a brand-new account holding about 0.2 MON from faucet.monad.xyz.
- Open https://hyperhedge-app.vercel.app.
- Keep the explorer open in a second tab.
- Record at 1440 px wide.

## Technical demo (3:00 max)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Landing, then `/app` Markets | "AI teams prepay for GPU capacity. When a provider under-delivers, the buyer eats the loss. HYPERHEDGE turns that delivery risk into a contract with a price, settled on Monad." |
| 0:20–0:45 | Open contract #3: terms panel | "The seller locks the full payout as collateral. The SLA is committed onchain by hash: the host, the proof difficulty, and how many proofs it must answer. The oracle policy is 2 of 3 signers with a 5-minute challenge window." |
| 0:45–1:20 | Test Funds: faucet hhUSD. Issue or open a contract with units left, then buy 1 unit | "This is a fresh wallet. Faucet, approve, buy. That is three Monad transactions, about seven seconds." Click the tx link to show it on the explorer. |
| 1:20–1:55 | Contract #1 proof tape (12 of 12 green), then #2 (3 of 12) | "During the delivery window the oracle challenges the host every 15 seconds. The seed comes from a fresh Monad block hash, so it can't be precomputed. Here the host delivered every proof. Here we stopped the host mid-window, so the proofs stop." |
| 1:55–2:25 | Contract #2: press **Verify the evidence yourself** | "Don't trust our oracle. This button re-derives every seed, re-checks every proof and compares every block hash with the chain, in your browser. The verdict matches what was signed onchain." |
| 2:25–2:50 | Contract #3 and Settlements | "Here the seller disputed a valid failure. The dispute costs a bond. The guardian upheld the report, the bond went to the buyers, and each claimed 110: the payout plus their share of the bond." |
| 2:50–3:00 | Liquidity: `reconcile()` OK | "Every token in the vault is accounted for, onchain. 64 Foundry tests including invariants. Unaudited, testnet, and the limits are in the README." |

**Backup:** if testnet is slow during recording, narrate over the explorer links in `docs/RELEASE_GATE.md`. Every one of those transactions is already final.

## Pitch video (2:00 max)

| Time | Say |
|---|---|
| 0:00–0:15 | **Team:** who you are, one line each. |
| 0:15–0:45 | **Problem:** "Compute is now bought like a commodity, with reserved capacity and prepaid. There is no way to hedge the risk that it doesn't show up. Today the remedy is SLA credits from the provider who just failed you." |
| 0:45–1:20 | **Solution:** "HYPERHEDGE is a fully collateralized market for delivery risk. Sellers lock the maximum payout. Hosts prove delivery with real work, challenge by challenge, seeded by Monad blocks. A 2-of-3 signed report settles it, and anyone can re-verify the evidence. Monad's 300 ms blocks make a challenge every few seconds cheap enough to be the default." |
| 1:20–1:45 | **Proof:** "It is live on Monad testnet: delivered, failed and disputed lifecycles from fresh wallets, a MON/USD price-protection pool, and an onchain order book for positions." |
| 1:45–2:00 | **Next:** "A GPU provider pilot, independent signer operators, and an audit before any real money." |
