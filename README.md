# HYPERHEDGE

### Onchain protection against failed compute delivery and token price risk.

HYPERHEDGE turns compute-delivery risk into a collateral-backed financial contract. Sellers lock the full required payout before a protection contract becomes active. Buyers pay a premium for protection. When delivery fails under the configured evidence policy, the protocol supports a claim against the locked collateral.

Built on **Monad Testnet** for the **Monad Metropolis 2026 Hackathon**, HYPERHEDGE combines collateralized compute protection, challenge-based evidence verification, onchain claims and disputes, and a separate price-protection market.

**Links**

- **Live app:** https://hyperhedge-app.vercel.app/
- **GitHub:** https://github.com/Venkat5599/Mn
- **Technical demo:** https://youtu.be/OzmEvWe_AeY
- **Pitch video:** https://youtu.be/8iwdtkfP4oc
- **Track:** Onchain Finance & Trading
- **Network:** Monad Testnet, Chain ID `10143`

> **Status:** Working hackathon prototype. Testnet only. Not audited. Test tokens have no monetary value.

---

## The problem

AI teams increasingly depend on reserved compute capacity. When a provider oversells a cluster, a node goes offline, or capacity arrives late, the buyer can lose time and money. A service-level agreement does not necessarily guarantee that compensation will be available when delivery fails.

HYPERHEDGE explores a different model: instead of relying only on a provider's promise to compensate a buyer, require the payout to be backed by collateral before the protection contract becomes active.

## How HYPERHEDGE works

1. **Create a contract.** Define the compute-delivery commitment and the applicable protection conditions.
2. **Lock collateral.** The seller deposits the required collateral before the contract becomes active.
3. **Purchase protection.** The buyer pays a premium for the agreed protection.
4. **Challenge the host.** The oracle service sends time-sensitive challenges to the host-side agent.
5. **Record evidence.** Responses and missed challenges are recorded for verification.
6. **Verify the report.** The configured signer threshold produces a signed report that the onchain verifier can check.
7. **Settle the outcome.** The applicable claim or dispute path can be executed against the locked collateral.

The design separates three things that are often conflated: the financial commitment, the evidence used to evaluate delivery, and the onchain settlement.

## What makes it different

HYPERHEDGE is not simply a compute marketplace. Its central idea is to make protection a separate, collateral-backed financial commitment.

- **Collateral before activation:** the required payout must be locked before the protection contract becomes active.
- **Evidence-based outcomes:** the system records challenge responses and missed challenges instead of relying solely on a provider's assertion.
- **Onchain-verifiable reports:** signed reports are checked against the configured verifier and chain context.
- **Dispute incentives:** the prototype includes a dispute-bond mechanism for configured dispute outcomes.
- **Separate price protection:** the application also includes a market prototype for protection against price movements.

These are design and implementation goals, not a claim that all real-world compute delivery can already be independently verified.

## Compute-delivery evidence

The current prototype uses a challenge-response process.

A fresh Monad block hash contributes to challenge-seed generation. The host-side agent must compute a proof of work and return its response within the configured challenge window. Responses and missed challenges become evidence for the reporting process.

The current policy uses:

- **Signer threshold:** 2 of 3 signers
- **Challenge window:** 5 minutes
- **Dispute bond:** 10%

The demonstration configuration sends challenges at approximately 15-second intervals. These timings and thresholds are prototype configuration, not universal guarantees of the protocol.

The evidence service produces signed reports, and the onchain verifier checks them before the applicable outcome can proceed. The SDK also provides browser-side verification utilities so evidence checks can be reproduced.

### What the proof does and does not establish

The proof of work demonstrates that the host answered a configured computational challenge. It does **not**, by itself, establish that a real GPU was available, that a requested model ran correctly, that a workload produced valid output, or that a particular GPU performance level was achieved.

The current demonstration uses a CPU-based host environment. Integrating real GPU providers and independently validating workload-specific execution are future steps.

## Demonstrated scenarios

The testnet demonstration covers three contract flows using fresh wallets:

**1. Successful delivery**

The host answers the configured challenges, and the evidence process records the responses.

**2. Failed delivery**

The host stops answering challenges. The verification workflow reports failure, and the buyer exercises the configured claim path against the collateral.

**3. Disputed failure**

The seller disputes a reported failure. The configured dispute process upholds the failure outcome, the dispute bond is slashed according to the contract rules, and buyers claim their payouts. The demonstration reports that each buyer receives 110 hhUSD.

These are testnet demonstrations using test tokens and the current prototype's trust assumptions. They are not evidence of production use or independently operated oracle infrastructure.

## Price protection

HYPERHEDGE includes a separate price-protection pool for protection associated with a selected price strike.

The pool models a market where buyers pay a premium for protection and liquidity providers lock the collateral required by the configured payout rules. This extends the application's focus from compute-delivery risk to financial risk management.

The price-protection module is a prototype and should not be interpreted as an audited or production-ready financial product.

---

## Why Monad?

Monad provides the onchain execution and settlement layer for HYPERHEDGE.

The protocol uses smart contracts to manage protection agreements, collateral, evidence verification, and settlement state. Users can inspect the deployed contracts and relevant transactions on the Monad testnet explorer.

The project uses Alchemy RPC infrastructure to connect application services to Monad. Alchemy supplies blockchain connectivity; HYPERHEDGE's smart contracts implement the protocol's collateral and settlement logic.

The project's use of frequent, unpredictable challenges also makes transaction cost and execution speed important design considerations. The prototype explores this workflow on Monad Testnet.

## Deployed contracts

Network: **Monad Testnet**  
Chain ID: `10143`

| Contract | Address |
|---|---|
| ComputeMarket | `0x9dc5f35B0866bB0a1F046712B38f11E2544D701E` |
| CollateralVault | `0xf2aF6d0D92ED7106e064F02087586E4464E029D3` |
| OracleVerifier | `0xE65E13b3c69c1057FDDdA52CA96B0cB6721eb8D4` |
| TestUSD (hhUSD) | `0xeeBDcA711Cb71A85b791141180a9548206C94063` |
| PositionListings | `0x3203EEEB9F675cF818856727172120c33147a68E` |
| PriceProtectionPool | `0x4dC4E80DaE43f2149B5E104194522550921A71d9` |

Explorer: https://testnet.monadexplorer.com/

These are testnet deployments. Verify addresses and transaction details on the explorer before interacting with the contracts.

---

## Architecture

HYPERHEDGE is organized as a monorepo.

```text
Mn/
├── apps/
│   ├── web/          # Next.js application and trading interface
│   ├── oracle/       # Challenges, evidence, reports, keeper and API
│   └── agent/        # Host-side challenge-response agent
├── packages/
│   ├── contracts/    # Solidity contracts and Foundry tests
│   └── sdk/          # ABIs, signing, evidence and verification
├── deployments/      # Deployment information
├── docs/             # Product, architecture and financial documentation
├── scripts/          # Development and deployment scripts
└── video/            # Demo-related assets
```

### Web application

The web application provides the interface for interacting with the protocol and inspecting its state.

Current application areas include:

- Markets
- Price Protection
- Portfolio
- Evidence Center
- Settlements

### Smart contracts

The contracts implement the protection-market logic, collateral management, report verification, positions, and settlement paths.

### Oracle service

The oracle service coordinates challenge generation, evidence collection, report signing, and related API and keeper operations.

### Host agent

The host-side agent responds to challenges issued by the evidence service.

### SDK

The shared SDK provides contract interfaces and utilities for evidence handling, signing, and verification.

### Trust assumptions

The oracle and signer infrastructure remains a trust assumption. In the current demonstration, one operator runs all three demo signers. The prototype therefore does not demonstrate operational independence between the signers.

---

## Technology stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Smart contracts | Solidity, Foundry |
| Blockchain | Monad Testnet |
| RPC infrastructure | Alchemy |
| Signing and reports | EIP-712 |
| Shared protocol code | TypeScript SDK |
| Testing | Foundry and SDK tests |
| Package management | Bun |

## Testing and security checks

The project reports:

- **69 passing Foundry tests**, including fuzzing, invariant testing, and adversarial token scenarios.
- **8 SDK tests.**
- **Six deployed contracts with source verification reported.**
- EIP-712 reports bound to chain and verifier context, with replay protection.
- Onchain collateral accounting and vault reconciliation checks.

These are project-reported development results. Run the tests yourself to reproduce them, and verify contract source and addresses using the testnet explorer.

Passing tests and source verification do not constitute an independent security audit.

---

## Getting started

### Requirements

- Bun 1.3 or later
- Foundry
- Git
- A Monad Testnet RPC endpoint for blockchain operations

### Install dependencies

```bash
git clone https://github.com/Venkat5599/Mn.git
cd Mn

bun install
bun run setup
```

### Run tests

```bash
bun run test
```

### Generate contract ABIs

```bash
bun run abi
```

### Start the web application

```bash
bun --cwd apps/web run dev
```

Open the local URL printed by the development server.

The oracle service, host agent, and deployment scripts may require additional configuration. Consult the relevant application and script files for the exact environment variables and commands.

### Environment variables

The deployment flow uses configuration including:

```text
MONAD_TESTNET_RPC_URL
DEPLOYER_PRIVATE_KEY
SIGNER_1_ADDRESS
SIGNER_2_ADDRESS
SIGNER_3_ADDRESS
```

Configure secrets in your local environment. Never commit private keys, API credentials, or signer secrets to GitHub, and never expose private keys through frontend environment variables.

### Deploy contracts

From the appropriate contracts package directory, configure the required environment variables and use the repository's deployment script:

```bash
forge script script/Deploy.s.sol \
  --rpc-url "$MONAD_TESTNET_RPC_URL" \
  --broadcast
```

Review the script and deployment configuration before broadcasting transactions. A fresh deployment may produce different addresses from those listed above.

Monad Testnet faucet: https://faucet.monad.xyz/

---

## Hackathon originality and build-window disclosure

HYPERHEDGE is submitted to the Monad Metropolis 2026 Hackathon under **Onchain Finance & Trading**.

The submission includes the integrated application, collateralized protection contracts, evidence and challenge workflow, signed-report verification, claim and dispute flows, price-protection module, SDK, tests, and Monad testnet deployments.

The hackathon rules permit pre-existing components only when they are identified and substantial new functionality is added during the hackathon period.

**Pre-existing project-specific work:**  
[Before submitting, identify any project-specific code, product functionality, or other material that existed before September 1, 2026. If none existed, state that accurately. Do not describe earlier work as newly built.]

**Substantial work added during the hackathon:**  
[Confirm which of the functionality described in this README was implemented during the September 1, 2026, onward build window. Adjust this list to match the actual commit history.]

Third-party frameworks, libraries, and developer tools are not claimed as original work. External code and assets must be attributed and used in accordance with their applicable licenses.

**Public commit history:**  
https://github.com/Venkat5599/Mn/commits/main/

The repository history should accurately represent the work performed during the hackathon. Do not rewrite or fabricate commit dates to create the appearance of work that did not occur during the build window.

## AI coding tools disclosure

AI coding tools were used as development assistance for this project.

**Tools used:** [List the AI coding tools actually used to build HYPERHEDGE.]

**How they were used:** [Briefly describe their actual roles, such as implementation assistance, debugging, test development, code review, or documentation. Remove any activity that did not occur.]

The team remains responsible for the project's design, code, integration, testing, deployment, and claims. AI assistance does not imply that the code is correct, independently verified, or secure.

---

## Limitations and future work

HYPERHEDGE is an experimental testnet prototype. It is not audited and should not be used to protect production workloads or assets of real monetary value.

Known limitations include:

- The current challenge mechanism does not independently prove real GPU execution or workload correctness.
- The demo signers are operated by a single operator.
- Production compute-provider integrations are not yet established.
- Oracle availability, signer integrity, evidence quality, and smart contract correctness remain important security considerations.
- The system requires further adversarial testing and an independent security audit before production deployment.

Planned development includes real provider integrations, independent signer operators, stronger workload-specific evidence, provider reliability history, improved monitoring, and an independent audit.

## External services and attribution

HYPERHEDGE uses open-source frameworks and libraries identified through its package manifests and relevant project files. Their authors and maintainers retain their respective rights under the applicable licenses.

Alchemy is used for Monad RPC connectivity. This does not imply endorsement or sponsorship by Alchemy or Monad.

Review the actual dependencies, copied code, and included assets before submission to ensure that all required third-party attribution is present.

## License

[Choose and confirm the project's actual open-source license.]

If releasing under the MIT License, add a complete root-level `LICENSE` file containing the MIT License text and the correct copyright holder. This README statement alone does not grant an MIT license.

## Demo

- **Live product:** https://hyperhedge-app.vercel.app/
- **Technical demo video:** https://youtu.be/OzmEvWe_AeY
- **Pitch video:** https://youtu.be/8iwdtkfP4oc

The videos demonstrate the project and its intended workflows. See the technical demo for the actual testnet interactions.

---

**HYPERHEDGE makes compute-delivery risk a financial commitment backed by collateral, evidence, and onchain settlement.**
