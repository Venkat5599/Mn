# Release gate: evidence for every item

The checklist from `docs/PRD.md` §9, with the test or testnet transaction that proves each item.

- **Tests:** run with `bun run test` (69 Foundry tests including fuzz, invariants and malicious tokens, 8 SDK tests, all passing on 11 Oct 2026).
- **Transactions:** live on Monad testnet (chain 10143). Explorer links use `https://testnet.monadexplorer.com/tx/<hash>`.

**Status: 18 of 20 met.** The two open items are the videos, which are recorded by the team.

## Financial invariants

| Item | Evidence |
|---|---|
| ✅ Seller collateral always covers the outstanding maximum payout | `invariant_collateralCoversLiabilities` (random action sequences), `test_cannotCreateBeyondFreeCollateral`, `testFuzz_solvency` (pool) |
| ✅ No position can be paid twice | `test_cannotClaimTwice`, `test_guardianVoidRefundsPremiumOnce`, `test_cannotSettleTwiceOrEarly` (pool) |
| ✅ Premiums and collateral are accounted for separately | `test_failurePaysBuyersAndSellerKeepsPremium`, `test_feeIsExplicitAndGoesToFees`, `invariant_vaultReconciles`; live `reconcile()` = OK after every run (`docs/runs/dispute-run.log`) |
| ✅ No withdrawal can bypass an active obligation | `test_sellerCannotWithdrawReserved`, `test_sellerBondMustComeFromFreeNotReserved`, `test_lpCannotWithdrawLocked` (pool) |

## Oracle security

| Item | Evidence |
|---|---|
| ✅ Unauthorized signatures are rejected | `test_rejectsUnauthorizedSigner`, `test_rejectsRevokedSigner`, `test_rejectsBelowQuorum`, `test_rejectsUnauthorizedAndBelowQuorum` (pool) |
| ✅ Duplicate and stale reports are rejected | `test_rejectsDuplicateSignerSignature`, `test_incidentIdCannotBeReplayedAcrossContracts`, `test_firstReportFixesOutcome`, `test_rejectsReportPastValidUntil`, `test_rejectsReportAfterExpiry`, `test_rejectsStaleBuyPrice` (pool) |
| ✅ Reports are bound to the correct contract and chain | `test_reportBoundToContractAndChain` (EIP-712 domain includes chain id and verifier) |
| ✅ Claim and dispute deadlines are enforced | `test_disputeOnlyInsideChallengeWindow`, `test_guardianTimeoutVoidsAndStillSlashes`, `test_rejectsObservationBeforeDeadline`, `test_rejectsSettlePriceOutsideWindow` (pool) |

## Trading integrity

| Item | Evidence |
|---|---|
| ✅ A buyer cannot buy more protection than is available | `test_cannotOversell`, `test_cannotBuyAfterSaleEnd`, `test_slippageGuard`, `test_cannotSellMoreThanPool` (pool) |
| ✅ Position ownership and claim rights stay consistent | `test_claimRightFollowsTransfer`, `test_claimRightMovesWithFill` (listings) |
| ✅ Invalid and replayed orders are rejected | `test_cannotOverfill`, `test_cancelledAndExpiredCannotFill`, `test_staleListingFailsWhenSellerMovedUnits`, `test_onlySellerCancels`, `test_listRequiresUnitsAndApproval` |
| ✅ Token transfer failures revert safely | `test_buyWithoutAllowanceRevertsCleanly`, `test_falseReturningTokenRevertsAndCreditsNothing`, `test_noReturnTokenWorksBothWays`, `test_reentrantWithdrawIsBlocked`, `test_reentrantDepositIsBlocked`. Fee-on-transfer tokens are not supported; `test_feeOnTransferIsDetectedByReconcile` shows `reconcile()` flags the mismatch. The deployed token is fixed at construction. |

## End-to-end proof on Monad testnet

**✅ A clean deployment creates and funds a contract.**
- The fresh deploy is at block 69,898,677.
- Contract 1: create `0xa8dfb22eb2766ad526b07afda84ce70d54aa045d7b91323d6225c49d60c6261a`.

**✅ A buyer purchases protection from a fresh wallet.**
- Three brand-new wallets each went faucet → approve → buy in **6.9 s, 7.5 s and 7.5 s** (contract 3).
- Buys:
  - `0x99df4e3d31ea62053e0dd588dae24be4b9a43db284a0ef445e46d61ffff11730`
  - `0x951b7f1c267a2a5c6cb801fe6e7c549a4dcff41dc77dc792e3a12a8c295ea9da`
  - `0xf8ecf7bd86264bd6e95270808b77692132db42ba511e07cf9f703440e6f6f0e7`

**✅ A failure produces a real testnet payout transaction.** Both failures were real: no simulated report was used.

*Contract 2:* the host agent was stopped mid-window, so 3 of 12 proofs were answered.
- Settled: `0xf27e64f48ea0852cec9149c2ebae0950992bdf6ff2c002f7d200bac308f10db1`
- Claim of 100 hhUSD: `0x9a86e0587276f8df757ab67d3585317e35f37baf9a3669ab47a1ffa4403df8e8`

*Contract 3:* the host never answered, so 0 of 6 proofs were answered.
- Each buyer claimed 110 hhUSD (payout plus bond share). Claims:
  - `0x37992d819224a5ec016759e27e8b1adce2de79a51642f4bd3050b3f634404df0`
  - `0x09421095674d76fae2f266e64d1321dd51a8ea83babb2bba2d0985cd00e92076`
  - `0xe3e91cf7964420d0042579cb3ba56d950182ccc5770d98d01372f0b75c281bff`

**✅ A delivered scenario releases funds only after valid expiry.**
- Contract 1 answered 12 of 12 proofs.
- Delivery final: `0xa6e6aa841b78be4e695b88ac8cc3a5df9238ed01f93a5525c3978d0edf31e7d6`
- Released only at expiry: `0x8b59a755e9e3616934bc664f3a5e481e74dc741a8124d31d66794cc71eaf6bce`
- Unit test: `test_deliveredReleasesOnlyAtExpiry`.

**✅ Frivolous dispute: the bond is slashed to buyers** (PRD §5 goal). On contract 3 the seller disputed a valid FAILURE.
- Dispute with a 30 hhUSD bond: `0x5bbb7b4a8a41aa6ad02e24abed119cf4b3f930ddc4d565dab011acdf77114dd0`
- The guardian upheld the report and the bond went to the buyers at 10 hhUSD per unit: `0x6bf286b894431e831b7e48aa7e3dc919409403e3fb3a5f214838eac3d84a3404`

## Submission quality

| Item | Evidence |
|---|---|
| ✅ Live product URL works, with clear access instructions | https://hyperhedge-app.vercel.app (HTTP 200); README "Try it" |
| ✅ Public GitHub repo is accessible | https://github.com/Venkat5599/Mn is public |
| ⬜ Demo uses a fresh wallet and visible transaction hashes | Recorded in the demo video; script in `docs/DEMO_SCRIPT.md` |
| ⬜ Technical demo (≤ 3 min) and pitch video (≤ 2 min) | To record; scripts in `docs/DEMO_SCRIPT.md` |

This gate does not replace an independent security review. The contracts are not audited.
