# Demo and pitch scripts

**Before recording:**
- Use a fresh browser profile with MetaMask and a brand-new account holding about 0.2 MON from faucet.monad.xyz.
- Open https://hyperhedge-app.vercel.app.
- Keep the explorer open in a second tab.
- Record at 1440 px wide.

## Technical demo (3:00 max)

**About 4 minutes before you hit record:** in a second wallet, go to **Issue** and create a contract.
- Set sale to 1 minute and delivery to 3 minutes. Leave the host on the default demo host.
- Its delivery window will be running during the take, so its proof tape fills in live.
- The landing hero automatically features whichever contract is inside its window.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Landing page: the hero window filling with proofs live | "AI teams prepay for GPU capacity. When a provider under-delivers, the buyer eats the loss. HYPERHEDGE turns that delivery risk into a contract with a price, settled on Monad. This window is a real contract being proven right now." |
| 0:20–0:45 | `/app`, open contract **#4**: terms panel | "The seller locked the full payout, 900 hhUSD, before this contract could exist. The SLA is committed onchain by hash: the host, the proof difficulty, and how many proofs it must answer. Reports need 2 of 3 signers, with a 5-minute dispute window." |
| 0:45–1:15 | Fresh wallet: **Test Funds** → faucet, then #4 → buy 1 unit | "A brand-new wallet. Faucet, approve, buy: three Monad transactions in about seven seconds." Click the tx link to show it on the explorer. |
| 1:15–1:50 | The contract you issued: proof tape filling; then #1 (12 of 12) and #2 (3 of 12) | "Every 15 seconds the oracle challenges the host with a seed from a fresh Monad block hash, so it can't be precomputed. Green is a proof answered in time. Contract 1 delivered every proof. On contract 2 we pulled the host mid-window, and the proofs stop." |
| 1:50–2:20 | Contract #2: press **Verify the evidence yourself** | "Don't trust our oracle. This re-derives every seed, re-checks every proof and compares every block hash with the chain, in your browser. Its verdict matches what was signed onchain, and the buyer was paid." |
| 2:20–2:45 | Contract #3, then **Settlements** | "Here the seller disputed a valid failure. Disputing costs a bond. The guardian upheld the report, the bond went to the buyers, and each claimed 110: the payout plus a share of the bond." |
| 2:45–3:00 | **Liquidity**: vault reconciles = Yes | "Every token in the vault is accounted for, checked onchain. 69 Foundry tests, including invariants and malicious tokens. Testnet and unaudited, and the limits are in the README." |

**Backup:** if testnet is slow during recording, narrate over the explorer links in `docs/RELEASE_GATE.md`. Every one of those transactions is already final.

## Pitch video (2:00 max)

| Time | Say |
|---|---|
| 0:00–0:15 | **Team:** who you are, one line each. |
| 0:15–0:45 | **Problem:** "Compute is now bought like a commodity, with reserved capacity and prepaid. There is no way to hedge the risk that it doesn't show up. Today the remedy is SLA credits from the provider who just failed you." |
| 0:45–1:20 | **Solution:** "HYPERHEDGE is a fully collateralized market for delivery risk. Sellers lock the maximum payout. Hosts prove delivery with real work, challenge by challenge, seeded by Monad blocks. A 2-of-3 signed report settles it, and anyone can re-verify the evidence. Monad's 300 ms blocks make a challenge every few seconds cheap enough to be the default." |
| 1:20–1:45 | **Proof:** "It is live on Monad testnet: delivered, failed and disputed lifecycles from fresh wallets, a MON/USD price-protection pool, and an onchain order book for positions." |
| 1:45–2:00 | **Next:** "A GPU provider pilot, independent signer operators, and an audit before any real money." |
