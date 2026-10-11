# HYPERHEDGE

**Protection against GPU compute that is not delivered, priced and settled on Monad.**

Live: **https://hyperhedge-app.vercel.app** · Monad testnet (chain 10143)

AI teams prepay for reserved GPU capacity. When a provider under-delivers, the buyer carries the whole loss and the usual remedy is SLA credits from the provider that just failed. HYPERHEDGE turns that delivery risk into a contract with an explicit price:

- **The buyer** pays a premium per unit of protection.
- **The seller** locks the full maximum payout as collateral, so protection can never go unpaid.
- **The host** proves delivery with real compute during the delivery window, challenge by challenge.
- **A verified failure** pays the buyer from the collateral, onchain. Delivery returns the collateral plus the premium to the seller.

## Delivery is proven, not asserted

During the delivery window the oracle sends the seller's host a challenge every few seconds:

- **The challenge:** a seed derived from a fresh Monad block hash, so it can't exist before that block and can't be precomputed.
- **The host's job:** find a nonce where `sha256(seed ‖ nonce)` has *d* leading zero bits. That is about 2^*d* hashes of real work, and checking it takes one hash.
- **Timing:** an answer that is late, wrong or missing counts as not delivered.

After the deadline:

- **Evidence file:** every challenge, block, seed, nonce and timestamp. Its keccak256 goes onchain with the report.
- **Signatures:** the report needs 2 of 3 EIP-712 signatures to be accepted.
- **Anyone can re-check it:** the contract page has a **Verify the evidence yourself** button. It re-derives every seed, re-checks every proof and compares every block hash with the chain, in your browser.

The demo host is a 2-core VPS running `apps/agent`. GPU hosts use the same protocol; the compute class is a field in each contract's SLA.

## The contract

| | |
|---|---|
| Payout | binary: `F × M`, where `F` = verified failure (0 or 1), `M` = units × payout per unit |
| Collateral | `C = M`, fully collateralized at creation |
| Accounting | free, reserved, premium, payable, bond and fee buckets that never mix; `vault.reconcile()` proves every token is accounted for, onchain |
| Reports | EIP-712, bound to chain and verifier, 2-of-3 signers, replay-protected, first valid report fixes the outcome |
| Disputes | 5-minute challenge window; a dispute needs a bond (10% of M), slashed to the other side if the report stands **or if the guardian never rules** |
| Missing data | never pays out: no report by expiry means the seller is released; an oracle that missed its own window abstains |

Full rules: [`docs/FINANCIAL_MODEL.md`](docs/FINANCIAL_MODEL.md). Product: [`docs/PRD.md`](docs/PRD.md). System: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Live deployment (Monad testnet)

| Contract | Address |
|---|---|
| ComputeMarket | [`0x9dc5f35B0866bB0a1F046712B38f11E2544D701E`](https://testnet.monadexplorer.com/address/0x9dc5f35B0866bB0a1F046712B38f11E2544D701E) |
| CollateralVault | [`0xf2aF6d0D92ED7106e064F02087586E4464E029D3`](https://testnet.monadexplorer.com/address/0xf2aF6d0D92ED7106e064F02087586E4464E029D3) |
| OracleVerifier | [`0xE65E13b3c69c1057FDDdA52CA96B0cB6721eb8D4`](https://testnet.monadexplorer.com/address/0xE65E13b3c69c1057FDDdA52CA96B0cB6721eb8D4) |
| TestUSD (hhUSD) | [`0xeeBDcA711Cb71A85b791141180a9548206C94063`](https://testnet.monadexplorer.com/address/0xeeBDcA711Cb71A85b791141180a9548206C94063) |
| PositionListings | [`0x3203EEEB9F675cF818856727172120c33147a68E`](https://testnet.monadexplorer.com/address/0x3203EEEB9F675cF818856727172120c33147a68E) |
| PriceProtectionPool (MON/USD) | [`0x4dC4E80DaE43f2149B5E104194522550921A71d9`](https://testnet.monadexplorer.com/address/0x4dC4E80DaE43f2149B5E104194522550921A71d9) |

**A real run** (`bun --cwd apps/oracle run demo`):

- **Contract 1, the host delivered:** 12 of 12 proofs answered.
  - [create](https://testnet.monadexplorer.com/tx/0xa8dfb22eb2766ad526b07afda84ce70d54aa045d7b91323d6225c49d60c6261a), [buy](https://testnet.monadexplorer.com/tx/0xa85851edffb03dd1e9fd1771476d2a760570231564856296487de5bbf653c5b7).
  - Oracle verdict DELIVERED, evidence `0x3870a52b…8205`.
- **Contract 2, the host went down:** the agent was stopped on the VPS.
  - [create](https://testnet.monadexplorer.com/tx/0x5799bba0f8a253f8b4a27af6fc468cf19967caa13e54dabc42ebff4cfebb4de2), [buy](https://testnet.monadexplorer.com/tx/0xeb10cdd6f75655abb072a8a04c71c1afbe3d13359c726169b2f7bbdf62bf072b).
  - Challenges went unanswered, the oracle reported FAILURE, and the buyer claimed the payout ([claim](https://testnet.monadexplorer.com/tx/0x9a86e0587276f8df757ab67d3585317e35f37baf9a3669ab47a1ffa4403df8e8)).

**The dispute run, from three fresh wallets** (`bun --cwd apps/oracle run dispute`, log in [`docs/runs/dispute-run.log`](docs/runs/dispute-run.log)):

- **Contract 3, three brand-new wallets buy:** each goes faucet → approve → buy in **7 to 8 seconds**.
- **The host never answers:** 0 of 6 proofs, so the oracle reports FAILURE.
- **The seller disputes the valid failure:** [dispute](https://testnet.monadexplorer.com/tx/0x5bbb7b4a8a41aa6ad02e24abed119cf4b3f930ddc4d565dab011acdf77114dd0) with a 30 hhUSD bond.
- **The guardian upholds the report:** [resolve](https://testnet.monadexplorer.com/tx/0x6bf286b894431e831b7e48aa7e3dc919409403e3fb3a5f214838eac3d84a3404). The bond is slashed to the buyers.
- **Each buyer claims 110 hhUSD:** 100 in payout plus 10 from the bond ([1](https://testnet.monadexplorer.com/tx/0x37992d819224a5ec016759e27e8b1adce2de79a51642f4bd3050b3f634404df0), [2](https://testnet.monadexplorer.com/tx/0x09421095674d76fae2f266e64d1321dd51a8ea83babb2bba2d0985cd00e92076), [3](https://testnet.monadexplorer.com/tx/0xe3e91cf7964420d0042579cb3ba56d950182ccc5770d98d01372f0b75c281bff)).
- **`vault.reconcile()` returns OK.**

**The price-protection pool, MON/USD:**

- **LP deposit:** 1,000 hhUSD ([tx](https://testnet.monadexplorer.com/tx/0xe99dbb6707a0d425f4f97e29029be918b7db5a0c61946634dfca10f89dfc3041)).
- **Buy:** a $10 put at a 95% strike, spot $0.02495 ([tx](https://testnet.monadexplorer.com/tx/0xc355d010bb516c47cf3f831c2e4d03510b9fa631000582cc749c67a521aaedac)).
- **Settle:** at expiry, with a 2-of-3 signed price of $0.02541. That is above the strike, so it paid 0, as the terms say ([tx](https://testnet.monadexplorer.com/tx/0x2a0296603421a7c16fdd883e11c54f44ed6fc2a1a1beee64098d11ca5de4bbdb)).

Every release-gate item, mapped to its test or transaction: [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md).

## Try it (judges)

1. Open **https://hyperhedge-app.vercel.app** with MetaMask or any EVM wallet. It offers to add Monad testnet.
2. **Test funds:** MON from [faucet.monad.xyz](https://faucet.monad.xyz), then 1,000 hhUSD from the in-app faucet. hhUSD is a test token with no value.
3. **Buy:** contract **#4** stays open for buyers until 20 Oct (18 units, 4 hhUSD premium, 50 hhUSD payout). Or **Issue** your own short contract to watch a full lifecycle. The host URL defaults to the demo VPS agent.
4. **Watch:** follow the proof tape fill in during the delivery window, then press **Verify the evidence yourself** after the report.

## Repository

```
packages/contracts   Foundry: ComputeMarket, CollateralVault, OracleVerifier, PositionListings, PriceProtectionPool, TestUSD
packages/sdk         ABIs, EIP-712 types, SLA commitment, proof-of-work evidence and its verifier
apps/agent           runs on the compute host: answers proof-of-work challenges
apps/oracle          challenges hosts, builds evidence, signs 2-of-3 reports, keeper, read-only API
apps/web             Next.js trading terminal
docs                 PRD, architecture, financial model
deployments          addresses per chain
```

## Run it

Needs [bun](https://bun.sh) 1.3+ and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run setup                 # forge-std + OpenZeppelin
bun run test                  # 8 sdk tests, then 69 Foundry tests (unit, fuzz, invariants, malicious tokens)
bun run abi                   # regenerate ABIs after contract changes
bun --cwd apps/web run dev    # terminal on http://localhost:3000
```

Deploy your own: put `DEPLOYER_PRIVATE_KEY` and `SIGNER_{1,2,3}_ADDRESS` in `.env`, then run `forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC_URL --broadcast` from `packages/contracts`.

## Verified

| Check | Result |
|---|---|
| Foundry unit + fuzz, every edge case in the financial model, listings, price pool and malicious tokens | 69 / 69 pass |
| Invariants (vault reconciles, collateral covers liabilities) over random action sequences | pass |
| SDK: proof-of-work, SLA commitment, evidence recount and tamper detection | 8 / 8 pass |
| Delivered, failed and disputed lifecycles on Monad testnet, from fresh wallets | see the runs above |

## Known limits, stated plainly

- **Not audited.** Testnet only, with a test token.
- **One operator runs all three signers in the demo.** The quorum is real onchain; independent signer operators are the next step.
- **The guardian is trusted** to resolve disputes. It is bounded by a deadline and the bond rules.
- **Timestamps in the evidence are the oracle's clock.** The proofs and block-bound seeds are what anyone can check.
- **The demo host is a CPU VPS.** A GPU provider pilot is the path forward.
