# HYPERHEDGE PRD

**One-liner:** A collateralized marketplace for trading GPU compute delivery risk.
**Hackathon:** Monad Metropolis 2026. Track: Onchain Finance & Trading ($30k, 3 winners at $10k each).
**Deadline:** 14 Oct 2026, 09:29 IST (13 Oct, 11:59 PM ET).
**Status:** v3.0, 10 Oct 2026. Follows product specification v1.0. Pitchside is parked.
**Companion docs:** `docs/FINANCIAL_MODEL.md` (the mechanism, defined before any code), `docs/ARCHITECTURE.md`.

HYPERHEDGE lets compute buyers move defined delivery risk to capital providers. It does this through standardized, collateralized contracts that settle onchain when an independently verifiable condition is met.

The MVP is one product: **Compute Delivery Protection (CDP)**. Once CDP works end to end, the same model extends to compute forwards, performance-risk contracts and a deeper secondary market.

---

## 1. Problem

AI companies and GPU-cloud customers commit to future compute capacity more and more. They lose money when:
- Reserved GPU capacity is not delivered by the deadline.
- Delivered capacity misses a contractually specified service level.
- They cannot move the financial risk of a provider failing onto another counterparty.

Bilateral agreements cover some of this. They are hard to standardize, transfer or settle automatically.

HYPERHEDGE offers a standardized onchain contract:
- The buyer pays a premium for protection.
- The seller locks collateral.
- A pre-agreed evidence policy decides whether a payout is triggered.

## 2. Product promise

**Every protection contract has an explicit price, an enforceable collateral limit, a verifiable settlement condition and an auditable payout.**

| Principle | Meaning |
|---|---|
| Trust through verifiability | Terms, collateral, oracle reports and settlement transactions can all be inspected independently |
| Fast settlement | Monad executes the contracts and token transfers. The UI shows the real transaction status and never invents instant finality. |
| Bounded risk | Protection is capped by explicit terms, locked collateral and defined payout rules |

## 3. Users

| User | Need | What HYPERHEDGE gives them |
|---|---|---|
| AI startup / compute buyer | Protect a compute reservation against non-delivery | Protection for a known premium |
| GPU-cloud provider / broker | Make future obligations more attractive to buyers | Standardized, collateral-backed commitments |
| Capital provider (seller) | Earn premiums for taking on defined risk | Deposits collateral and sells protection |
| Market maker | Quote protection and manage exposure | Trades standardized positions (P1) |
| Risk analyst | Judge whether a contract is priced sensibly | Sees exposure, evidence policy, collateral and payout rules |

**First customer:** an AI startup or GPU-cloud broker that buys reserved compute and can name what a missed delivery costs it.

**Not claimed:** no partnerships, pilots or demand we have not validated. Before the pitch video, try to talk to one real buyer of reserved compute and quote them only with permission.

The first release does not need a real provider integration to prove the mechanism. It must clearly separate simulated evidence from independently verified production evidence.

## 4. Scope

### P0: required for submission
1. Connect a wallet on Monad testnet.
2. Browse and inspect standardized protection contracts.
3. Create a contract with fixed terms.
4. Deposit seller collateral.
5. Buy protection, with the premium held in escrow.
6. Publish signed oracle reports for a controlled test incident.
7. Settle a valid claim onchain.
8. Release or refund funds on valid expiry.
9. Show transaction hashes, balances, open exposure and claim status.
10. Run reproducible end-to-end tests from a clean deployment.

### P1: differentiators
- Transferable positions with explicit ownership and claim rights.
- Secondary market for existing positions (onchain listings with enforceable fills).
- Transparent premium breakdown and live executable quotes.
- Portfolio-level seller exposure and collateral utilization.
- Multiple oracle signers (quorum) and an auditable incident history.

### P2: after the core market works
Compute forwards, SLA uptime and throughput derivatives, production provider adapters, market-maker integrations, cross-margining, structured products.

**P2 is never on the hackathon critical path.** One secure, working market beats three half-built products.

## 5. Goals and success metrics (by submission)

| Goal | Metric | Target |
|---|---|---|
| Works onchain | Full lifecycles on Monad testnet from a clean deployment | ≥ 1 failure → payout, ≥ 1 delivered → expiry release, ≥ 1 frivolous dispute with the bond slashed to buyers |
| Real trading | Protection purchases from distinct fresh wallets | ≥ 3 wallets |
| Correctness | Vault accounting reconciles with the token balance after every run | 100% |
| Release gate | Definition-of-done checklist (§9) | 20 / 20 |
| Judge access | Fresh visitor to first purchase, using the faucet | < 60 s |

**Non-goals:** leverage, undercollateralized protection, cross-margining, partial payouts, real provider integrations, mainnet, real money.

## 6. User stories

1. As a seller, I deposit test USD into the vault and create a contract. Its terms are committed, and collateral equal to its maximum payout is reserved from my free balance.
2. As a buyer, before I pay I see the premium, every fee, the maximum payout, the seller's collateral, the deadlines, the evidence policy, and whether the oracle is simulated.
3. As a buyer, I approve the token and buy units of protection. I see the receipt and the collateral now covering my position.
4. As the oracle service, I publish a signed incident report that anyone can submit. The contract checks the signatures and the quorum.
5. As the seller, I can dispute a failure report during the challenge window by locking a dispute bond from my free balance. I lose the bond to the buyers if the dispute is upheld or never resolved.
6. As a buyer, once a failure is final I claim my payout exactly once.
7. As a seller, after a valid expiry with no unresolved claim, my collateral and the earned premium are released.
8. As anyone, I trace a claim from incident report to verification to payout transaction in the settlement explorer.
9. As a judge, I get test tokens from the faucet and buy protection without installing anything.

## 7. Trust requirements: every trade confirmation shows

- Total premium and every fee.
- Maximum payout and any payout limits.
- Seller collateral and the collateral asset.
- Delivery deadline, expiry and claim window.
- Evidence policy, and whether the oracle is **simulated**.
- Network and token details. The token is labelled "test token, not real USDC, no dollar value".
- The action the transaction will take, and its actual status.
- Counterparty and oracle risks.

**Banned:** fake liquidity, fabricated volume, misleading yield figures, and simulated transactions shown as real fills. A small, honest market beats a busy dashboard of invented data.

## 8. The 3-minute technical demo

| Time | Beat |
|---|---|
| 0:00–0:30 | **The market.** The GPU delivery obligation, premium, collateral, maximum payout and evidence policy. |
| 0:30–1:10 | **A real trade.** A fresh funded test wallet buys protection. Show the receipt and the collateral onchain. |
| 1:10–2:00 | **Simulated failure.** The oracle service signs an incident report (labelled SIMULATED), it is submitted, and the verifier accepts the quorum. The challenge window runs out. |
| 2:00–2:35 | **Settlement.** Payout transaction, buyer balance up, seller collateral down, final contract state. |
| 2:35–3:00 | **Trust layer.** Contract explorer, event history, test results, and the path to a real provider pilot. |

Record only after the demo works from a fresh wallet on a clean deployment. Keep a backup deployment and transaction history in case testnet is unreliable.

## 9. Definition of done (release gate)

**Financial invariants**
- [ ] Seller collateral always covers the outstanding maximum payout
- [ ] No position can be paid twice
- [ ] Premiums and collateral are accounted for separately
- [ ] No withdrawal can bypass an active obligation

**Oracle security**
- [ ] Unauthorized signatures are rejected
- [ ] Duplicate and stale reports are rejected
- [ ] Reports are bound to the correct contract and chain
- [ ] Claim and dispute deadlines are enforced

**Trading integrity**
- [ ] A buyer cannot buy more protection than is available
- [ ] Position ownership and claim rights stay consistent
- [ ] Invalid and replayed orders are rejected
- [ ] Token transfer failures revert safely

**End-to-end proof**
- [ ] A clean deployment creates and funds a contract
- [ ] A buyer purchases protection from a fresh wallet
- [ ] A simulated failure produces a real testnet payout transaction
- [ ] A delivered scenario releases funds only after valid expiry

**Submission quality**
- [ ] Live product URL works, with clear access instructions
- [ ] Public GitHub repo is accessible to metropolis@hackathon.monad.xyz
- [ ] Demo uses a fresh wallet and visible transaction hashes
- [ ] Technical demo (≤ 3 min) and pitch video (≤ 2 min) are within limits

This gate does not replace an independent security review. Fuzz, invariant and malicious-token/oracle tests come before any real-money deployment.

## 10. Deliverables

| Deliverable | Requirement |
|---|---|
| Project logo | Original, legible, PNG/JPG/WebP under 3 MB |
| Public repository | Accessible to metropolis@hackathon.monad.xyz |
| Technical demo | ≤ 3 minutes, the live product |
| Pitch video | ≤ 2 minutes: team, problem, solution |
| Live product | Deployed on Monad testnet, with access instructions |
| README | Setup, architecture, contract addresses, test commands, known limitations |
| Demo credentials | Faucet and test-wallet instructions. **Never publish private keys.** |
| Evidence | Tx hashes, test output, a reproducible incident scenario |

Check the hackathon's current network and deployment rules before submitting.

## 11. Positioning

The differentiation is three things together:
1. **A real financial primitive.** A defined right to a bounded payout if verifiable compute delivery fails.
2. **A credible trust model.** Collateral, signatures, expiry, claim rights and settlement rules are enforced by code, not by a trusted UI.
3. **A market that can grow.** The same contract model extends to transferable exposure, compute forwards and SLA-linked products.

We do not claim compute protection is unprecedented. The defensible innovation is this specific standardized, collateralized, transferable mechanism, how well it is executed, and a credible path to adoption.

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Crowded lane: the track suggests compute markets | High | Position on the trust model and executable settlement, not "compute exchange". Competitor sweep owed on D1. |
| Simulated oracle reads as a mockup | Medium | The contract verifies EIP-712 quorum signatures; there is no button that pays out. Evidence is hashed and published. Everything is labelled SIMULATED. |
| Guardian (dispute resolver) is a trusted party | Certain in the MVP | Stated plainly. It can only pick between outcomes the terms define, and must act within a deadline or the contract voids. Roadmap: bonded disputes, decentralized arbitration. |
| Seller griefs a valid failure by disputing | Low (fixed in P0) | **Dispute bond**, 10% of M in the demo, taken from fresh free balance. It is slashed to buyers if the dispute is upheld or the guardian misses the deadline, so a frivolous dispute always loses money. See FINANCIAL_MODEL §5a. |
| Oracle outage | Medium | Missing data never pays out (spec rule). The contract expires and the seller is released. Quorum of signers lowers the odds. |
| Testnet unreliable on demo day | Medium | Record a backup take on Oct 12. Keep the tx history. |
| ~3.5 days left | High | Build order in §13. The secondary market is cut first. |

## 13. Milestones (build order: core → invariants → testnet → UI → simulator → e2e → order book)

| Day | Date | Done when |
|---|---|---|
| D1 | Sat 10 Oct | `FINANCIAL_MODEL.md` frozen. `MockUSD`, `CollateralVault`, `OracleVerifier`, `ComputeMarket` with unit and invariant tests green. Competitor sweep done. |
| D2 | Sun 11 Oct | Deployed to Monad testnet. Oracle simulator signs and submits reports. `run-demo.ts` passes the failure, delivered and dispute paths on testnet. |
| D3 | Mon 12 Oct | Web: market explorer, trade ticket, risk terminal, settlement explorer, faucet. Fresh-wallet run. **Backup demo recorded.** |
| D4 | Tue 13 Oct | P1 if time allows: listings for positions. Polish, README, demo and pitch videos. |
| Submit | Wed 14 Oct before 09:29 IST | Release gate 20/20. Nothing uploaded in the last hour. |
