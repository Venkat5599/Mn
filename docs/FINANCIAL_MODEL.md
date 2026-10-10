# HYPERHEDGE financial model

The mechanism is defined here before any contract or UI is written. If code and this doc disagree, the code is wrong until this doc is changed on purpose.

## 1. Instrument: Compute Delivery Protection (CDP)

Each contract is one specific obligation, never a vague bet on a GPU company.

| Field | Type | Definition |
|---|---|---|
| `id` | uint256 | Unique onchain identifier |
| `seller` | address | Capital provider whose collateral backs the contract |
| `underlying` | bytes32 | Standard compute class, e.g. `H100-80GB-GPUh` |
| `quantity` | uint64 | Compute capacity covered, e.g. 1,000 GPU-hours |
| `slaHash` / `slaURI` | bytes32 / string | Hash and location of the objective delivery condition, in canonical JSON |
| `units` | uint64 | Protection units for sale (capacity N) |
| `payoutPerUnit` | uint128 | m, paid per unit on a verified failure |
| `premiumPerUnit` | uint128 | p, paid per unit by the buyer |
| `feeBps` | uint16 | Protocol fee on premium. 0 in the MVP and always shown. |
| `saleEnd` | uint64 | Purchases close |
| `deliveryDeadline` | uint64 | Latest permitted delivery time |
| `expiry` | uint64 | No new reports are accepted after this |
| `policyId` | uint32 | Evidence policy: signer set, quorum, challenge window, resolve window |

`saleEnd ≤ deliveryDeadline < expiry`. **Every field is immutable once created.** There is no setter.

Maximum payout: `M = N × m`.

## 2. Payout (binary, first release)

Symbols:
- `C`: seller collateral reserved for the contract
- `P`: premium paid
- `M`: maximum payout
- `F ∈ {0, 1}`: verified failure indicator

```
Payout = F × M          (per position: F × units_held × m)
Enforced at creation:  C = M  (fully collateralized; therefore C ≥ M always)
```

**Worked example.**
- The seller reserves 1,000 test USD (N = 10, m = 100), and a buyer pays 100 test USD (p = 10, all 10 units).
- **Failure (F = 1):** the buyer claims 1,000 from the collateral.
- **No failure (F = 0) at valid expiry:** the seller gets the 1,000 collateral plus the 100 premium (minus the fee).

The premium is not the payout. Neither is a fair market price; pricing is a separate risk model and the UI does not invent one.

## 3. Accounting buckets (never mixed)

The vault holds the single stake token. Every unit of it sits in exactly one bucket:

| Bucket | Holds | Moves to |
|---|---|---|
| `free[seller]` | Deposited, unreserved collateral | Withdrawable at any time; reserved on create |
| `reserved[id]` | Collateral backing contract `id` (= M at create) | Free again for unsold units at `saleEnd`; payouts on Settled; seller's free on Expired or Voided |
| `premium[id]` | Premiums paid for `id` | Seller (less fee) on Settled or Expired; buyers on Voided |
| `payable[id]` | Payouts owed after a failure is final (plus any slashed seller bond) | Holders, on claim |
| `bond[id]` | The disputer's bond while a dispute is open | Back to the disputer, or slashed to the counterparty (§5a) |
| `fees` | Protocol fees and rounding dust | Treasury |

**Conservation invariant**

```
token.balanceOf(vault) == Σ free + Σ reserved + Σ premium + Σ payable + Σ bond + fees
```

**Coverage invariant**

```
reserved[id] ≥ sold[id] × m      for every live contract
```

## 4. Lifecycle

```
Open ──buy──► Active ──valid report (quorum)──► Review ──window passes──► Settled   (F = 1: claims open)
  │              │                                │    └──window passes──► Expired  (F = 0: released at expiry)
  │              │                                └──dispute──► Disputed ──guardian──► Settled / Expired / Voided
  │              │                                                     └──resolve deadline missed──► Voided
  └─saleEnd, 0 sold─► Expired                └──expiry, no report──► Expired (missing data never pays)
```

| State | Entered when |
|---|---|
| Open | Terms committed and collateral reserved; nothing sold yet |
| Active | First purchase |
| Review | A quorum-valid report is accepted. `challengeEnd = now + challengeWindow`. |
| Disputed | A dispute is raised inside the challenge window **and its bond is locked** (§5a). One dispute per contract. |
| Settled | A failure is final. `payable[id] = sold × m`; the remainder of `reserved` goes back to the seller. |
| Expired | Delivered and final, or no report by `expiry`. Release happens only at or after `max(expiry, challengeEnd)`. |
| Voided | Guardian voids it, or misses the resolve deadline. Premiums go back to buyers and collateral to the seller. |

**Transitions are permissionless** (`finalize`, `expire`), except:
- `report` needs quorum signatures.
- `dispute`: the seller may dispute a FAILURE report; any position holder may dispute a DELIVERED report.
- `resolve`: guardian only.

## 5. Reports

The EIP-712 domain is `HYPERHEDGE / 1 / chainId / OracleVerifier address`.

```
IncidentReport { uint256 contractId; bytes32 incidentId; uint8 outcome; bytes32 evidenceHash;
                 uint64 observedAt; uint64 validUntil; }
outcome: 1 = FAILURE, 2 = DELIVERED
```

A report is accepted only if:
- Signatures come from ≥ `quorum` distinct, unrevoked signers of the policy, sorted ascending (no duplicate signers).
- `incidentId` has never been used.
- `block.timestamp ≤ validUntil` and `block.timestamp ≤ expiry`.
- `observedAt ≥ deliveryDeadline` (non-delivery cannot be known earlier).
- The contract is Active.

**The first accepted report fixes the outcome.** Any later report for that contract reverts.

## 5a. Dispute bond

Without a bond, a seller could dispute every valid failure for free and push it to the guardian. The bond makes a frivolous dispute cost money and gain nothing.

```
B = max(policy.disputeBondBps × M / 10_000, policy.minBond)      (demo: 10% of M)
```

**Who disputes, and where the bond comes from**

| Disputer | Can dispute | Bond comes from |
|---|---|---|
| Seller | A FAILURE report | The seller's **free** balance only. Never from `reserved[id]`, so the bond is new money at risk. |
| Any position holder | A DELIVERED report | The holder's wallet (token transfer in) |

**How the bond resolves**

| Resolution | Contract goes to | Bond |
|---|---|---|
| Guardian upholds the report (disputer wrong) | Settled (FAILURE) or Expired (DELIVERED) | **Slashed to the counterparty.** Seller's bond → `payable[id]`, shared per unit sold. Holder's bond → seller's `free`. |
| Guardian sides with the disputer | The disputer's outcome | Returned to the disputer |
| Guardian voids (evidence itself broken) | Voided | Returned to the disputer |
| Guardian misses `resolveBy` | Voided (no automatic payout, per spec) | **Slashed to the counterparty.** An unresolved dispute never profits the disputer. |

**The seller's bond splits across buyers by units held:**
```
bondPerUnit = B / sold     (floored; dust → fees)
claim pays  = units × (m + bondPerUnit)
```

**Why this closes the grief**
- With a working guardian, a seller who disputes a valid failure still pays `M` and also loses `B`.
- If the guardian fails to act, the seller avoids `M` but still loses `B`. The buyers get their premium back plus `B`.
- The remaining risk is a guardian who never acts. That is a trust assumption, stated in §8.

## 6. Edge cases (each one is a test)

| # | Case | Rule |
|---|---|---|
| 1 | Seller withdraws collateral with an obligation outstanding | Only `free` is withdrawable; `reserved` moves only through state transitions |
| 2 | Buyer claims twice | Claim burns the position; a second claim has zero balance |
| 3 | Unauthorized oracle | Signature not in the signer set → revert |
| 4 | Expired report | `validUntil` or `expiry` passed → revert |
| 5 | Duplicate report | Used `incidentId`, or the contract is already past Active → revert |
| 6 | Report after the claim window | After `expiry` → revert. Disputes only inside `challengeEnd`. |
| 7 | Obligation larger than the seller's collateral | Create reverts unless `free[seller] ≥ M` |
| 8 | Reentrancy / token transfer failure | `nonReentrant`, SafeERC20, checks-effects-interactions; tests use a malicious token that reenters and one that returns false |
| 9 | Double refund | Each bucket is zeroed before transfer; a terminal state cannot be re-entered |
| 10 | Dispute or outage silently paying out | Outage → Expired (no payout). A missed resolve deadline → Voided (refund), never Settled. |
| 11 | Buying more than is available | `sold + units ≤ N` |
| 12 | Buying after `saleEnd` | Revert |
| 13 | Seller disputes with no fresh funds | Revert unless `free[seller] ≥ B`. `reserved[id]` is never used for a bond. |
| 14 | Frivolous dispute is upheld | Bond slashed to the counterparty; seller's bond reaches buyers pro rata through `claim` |
| 15 | Guardian misses the deadline | Voided, and the bond is still slashed to the counterparty, never returned |
| 16 | Second dispute on the same contract | Revert: one dispute per contract |
| 17 | Bond claimed or slashed twice | `bond[id]` zeroed before any transfer; terminal states are final |

## 7. Positions (P1, but shaped now)

- Positions are ERC-1155, token id = contract id, balance = units.
- Claim rights belong to whoever holds the token at claim time, so a transfer moves the right with no duplication.
- Collateral obligations stay with the seller and never move with a position.

**Secondary listings**
- A holder lists `(contractId, units, pricePerUnit, expiresAt)` onchain.
- `fill` checks the listing is live, the seller still holds and has approved the units, and the order hasn't expired. Payment and position then move atomically.
- Filled or cancelled listings cannot be filled again.
- No leverage, no shorting and no undercollateralized positions.

## 8. Known limits, said plainly

- **Binary only:** partial delivery pays nothing unless the SLA defines it as failure.
- **Guardian:** dispute resolution is a trusted party in the MVP. The bond stops disputes from paying the disputer, but a guardian who never acts still turns real failures into refunds rather than payouts.
- **Bond size is per policy, not per position.** A holder with a small position may find disputing a wrong DELIVERED report too expensive. That is acceptable for the MVP, and noted.
- **Signatures prove who signed, not that the report is true.** Independent evidence and economic accountability (bonded signers) are separate, future requirements.
- **Demo evidence is SIMULATED and labelled that way.**
