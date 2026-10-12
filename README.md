# HYPERHEDGE

**Onchain protection against failed compute delivery, backed by locked collateral and verifiable evidence.**

HYPERHEDGE is a financial protocol prototype on Monad that lets buyers purchase protection against a compute provider failing to complete an agreed delivery commitment. Sellers lock collateral before a protection contract becomes active, and an evidence-verification process determines whether a failure can trigger a payout.

- **Live application:** https://hyperhedge-app.vercel.app/
- **Source code:** https://github.com/Venkat5599/Mn
- **Network:** Monad Testnet
- **Track:** Onchain Finance & Trading
- **Status:** Hackathon prototype. Not audited. Testnet assets have no monetary value.

---

## 1. The Problem

Compute buyers depend on providers to deliver workloads within agreed terms. When delivery fails, a service-level agreement alone does not guarantee that compensation will be available or that the outcome will be handled transparently.

HYPERHEDGE explores a different approach: make delivery risk a financial commitment with collateral locked onchain before the agreement begins.

The goal is to give buyers a defined protection mechanism, sellers a transparent way to back their commitments, and both sides a verifiable record of how a settlement was reached.

## 2. The Solution

HYPERHEDGE brings together collateralized delivery protection, challenge-based evidence verification, and onchain settlement.

1. **Create a protection contract.** The parties define the commitment and the conditions under which protection applies.
2. **Lock collateral.** The seller deposits the required collateral before the contract becomes active.
3. **Purchase protection.** The buyer pays a premium for the specified protection.
4. **Verify evidence.** A challenge-and-report process evaluates evidence against the configured delivery policy.
5. **Resolve the outcome.** The protocol allows the applicable settlement or claim path to be executed onchain.

The protocol is designed so that a promised payout is backed by locked collateral rather than an unsecured promise to pay later.

## 3. What Was Built During the Hackathon

The submission includes a working web application, smart contracts, an evidence-verification service, a host-side agent, and an SDK for interacting with the protocol.

The principal implementation areas are:

- **Collateralized compute protection:** contract creation, collateral requirements, buyer protection, and settlement paths.
- **Evidence verification:** challenge generation, evidence collection, signed reports, and verification logic.
- **Failure and dispute handling:** workflows for unanswered challenges, claims, disputes, and configured dispute outcomes.
- **Price protection:** a separate onchain market prototype for protection against price movements, with liquidity and payout collateral.
- **Trading interface:** markets, price protection, portfolio, evidence center, and settlements views.
- **Security and accounting:** collateral accounting, chain- and verifier-bound EIP-712 reports, and replay protection.
- **Testing and deployment:** Foundry contract tests, SDK tests, testnet deployments, and source verification.

These are the features represented by the current repository and application. The prototype does not yet establish that a real GPU completed a production workload or that a third-party compute provider is integrated.

## 4. How It Works

### Compute delivery protection

The protocol separates the protection agreement from the evidence used to determine its outcome.

- The seller locks collateral.
- The buyer purchases protection by paying a premium.
- A host-side agent responds to verification challenges.
- The evidence service collects the results and produces signed reports.
- The onchain verifier checks the report before the relevant settlement path can proceed.

The current evidence policy uses **two of three signers**, a **five-minute challenge window**, and a **10% dispute bond**, as configured by the prototype.

### Failure demonstration

The demo includes two contrasting scenarios:

**Successful challenge responses:** the host answers the challenges and the evidence process records the responses.

**Unanswered challenges:** the host stops responding, the verification process reports failure, and the buyer can exercise the configured claim path.

The implementation also includes a dispute demonstration in which a dispute is reviewed, a configured outcome is applied, and the vault's accounting is reconciled.

### Important evidence limitation

A completed challenge proves that the configured challenge was answered. It does **not**, by itself, prove GPU model, GPU availability, workload correctness, benchmark performance, or the quality of a real compute result.

The current demonstration uses a CPU-based host environment. Integrating real GPU providers and independently validating workload execution are future development steps.

## 5. Price Protection

HYPERHEDGE also contains a price-protection market prototype.

Users can interact with a pool that offers protection associated with a selected price strike. Liquidity providers lock the required payout collateral, while buyers pay a premium for the position.

The purpose is to explore how financial protection can be represented and settled through smart contracts on Monad.

This module is a separate risk-market component. It should not be interpreted as proof that the compute-delivery mechanism has been independently audited or validated in production.

## 6. Why Monad?

HYPERHEDGE uses Monad as the execution and settlement layer for its financial agreements.

Smart contracts manage the protocol's core state, including protection contracts, collateral, evidence verification, and settlement operations. Users can inspect the deployed contracts and verify relevant transactions on the Monad testnet explorer.

Keeping the financial state onchain makes contract conditions, collateral movements, and settlement transactions independently inspectable.

**Network details**

- Network: Monad Testnet
- Chain ID: `10143`
- RPC connectivity: Alchemy
- Test token: hhUSD

Alchemy supplies blockchain RPC connectivity. It is infrastructure for accessing Monad, not the source of the protocol's collateral guarantees or settlement rules.

## 7. Deployed Contracts

The following addresses are the project's documented Monad testnet deployments.

| Contract | Address |
|---|---|
| ComputeMarket | `0x9dc5f35B0866bB0a1F046712B38f11E2544D701E` |
| CollateralVault | `0xf2aF6d0D92ED7106e064F02087586E4464E029D3` |
| OracleVerifier | `0xE65E13b3c69c1057FDDdA52CA96B0cB6721eb8D4` |
| TestUSD (hhUSD) | `0xeeBDcA711Cb71A85b791141180a9548206C94063` |
| PositionListings | `0x3203EEEB9F675cF818856727172120c33147a68E` |
| PriceProtectionPool | `0x4dC4E80DaE43f2149B5E104194522550921A71d9` |

Explorer: https://testnet.monadexplorer.com/

These contracts are deployed to a test network. Do not send real funds or treat test tokens as assets with monetary value.

## 8. Architecture

HYPERHEDGE is organized as a monorepo.

```text
Mn/
├── apps/
│   ├── web/          # Next.js application and trading interface
│   ├── oracle/       # Challenges, evidence, reports, keeper and API
│   └── agent/        # Host-side challenge-response agent
├── packages/
│   ├── contracts/    # Solidity contracts and Foundry tests
│   └── sdk/          # ABIs, signing, evidence and verification utilities
├── deployments/      # Deployment information
├── docs/             # Product, architecture and financial documentation
├── scripts/          # Development and deployment scripts
└── video/            # Demo-related assets
```

### Main components

**Web application**

Provides the interface for browsing markets, interacting with price protection, viewing portfolio information, inspecting evidence, and following settlements.

**Smart contracts**

Manage protection agreements, collateral, verification, positions, and the relevant settlement rules.

**Oracle service**

Coordinates challenge generation and evidence collection, produces signed reports, and supports the verification workflow.

**Host-side agent**

Responds to challenges issued by the evidence service.

**SDK**

Contains shared contract interfaces and utilities for signing, evidence handling, and verification.

The oracle service and its signers are important trust assumptions. The current demo uses one operator to run all three demonstration signers; they should not be treated as three independently operated parties.

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Smart contracts | Solidity, Foundry |
| Blockchain | Monad Testnet |
| Blockchain connectivity | Alchemy RPC |
| Evidence and signing | Challenge-response workflow, EIP-712 signatures |
| Shared protocol code | TypeScript SDK |
| Testing | Foundry tests and SDK tests |
| Package management | Bun |

## 10. Run Locally

### Prerequisites

- Bun 1.3 or later
- Foundry
- Git
- Access to a Monad testnet RPC endpoint for blockchain operations

### Installation

Clone the public repository and install its dependencies:

```bash
git clone https://github.com/Venkat5599/Mn.git
cd Mn

bun install
bun run setup
```

Run the test suite:

```bash
bun run test
```

Generate contract ABIs:

```bash
bun run abi
```

Start the web application:

```bash
bun --cwd apps/web run dev
```

Open the local address printed by the development server.

Follow the repository's deployment scripts and configuration for running the oracle service, host agent, and contracts. Some workflows require environment variables and funded testnet accounts.

### Environment configuration

Configure secrets locally using the variable names expected by the relevant application and deployment scripts. Do not commit private keys, API keys, signer secrets, or production credentials.

The project uses configuration including:

- `MONAD_TESTNET_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `SIGNER_1_ADDRESS`
- `SIGNER_2_ADDRESS`
- `SIGNER_3_ADDRESS`

The applications may require additional environment variables. Check the relevant configuration files and setup documentation before starting each service.

Never place private keys in frontend-exposed environment variables.

### Deployment

The repository's Foundry deployment flow uses:

```bash
forge script script/Deploy.s.sol \
  --rpc-url "$MONAD_TESTNET_RPC_URL" \
  --broadcast
```

Run deployment commands from the appropriate contracts package directory, with the required environment variables configured. Review the deployment script before broadcasting transactions.

For testnet funding, use the official faucet:

https://faucet.monad.xyz/

Do not deploy over existing addresses or assume a fresh deployment will use the addresses documented above.

## 11. Testing and Verification

The project reports the following test results:

- **69 Foundry tests passing**
- **8 SDK tests**
- Source verification reported for all six documented testnet contracts

These results describe the project's recorded development and test status. They are not a substitute for an independent security audit, formal verification, or production testing.

To reproduce the tests, run `bun run test` from the repository root with the required toolchain installed.

## 12. Pre-existing Work and Originality Disclosure

HYPERHEDGE is submitted as a working prototype developed for the Metropolis Hackathon. The repository contains the application, protocol implementation, tests, deployment configuration, and documentation that make up this submission.

**Hackathon contribution:** The submitted work includes the integrated collateralized compute-protection workflow, evidence and challenge handling, signed-report verification, claim and dispute paths, price-protection functionality, the web interface, and the associated tests and Monad testnet deployments.

**Pre-existing components:** The project relies on established open-source frameworks, libraries, and developer tools listed in the technology stack and dependency manifests. These third-party components are not claimed as original work.

Any project-specific code or product functionality that existed before September 1, 2026, must be explicitly identified here before submission. For each such component, state what existed before the hackathon and what substantial functionality was added during the hackathon. Do not label earlier project-specific work as newly built.

The public Git history is available at:

https://github.com/Venkat5599/Mn/commits/main/

The commit history should accurately reflect the work performed during the hackathon period, September 1 through November 3, 2026. The hackathon submission deadline is October 13, 2026, so the version submitted by that deadline is the version that matters for judging.

## 13. AI Coding Tools Disclosure

AI coding tools were used as development assistance during the project. They supported implementation work, debugging, code review, and documentation.

The use of AI tools does not mean that generated code was independently validated or that the protocol is secure. Project-specific implementation, integration, testing, deployment, and submission decisions remain the responsibility of the project team.

**Before submitting:** update this disclosure to name every AI coding tool actually used on HYPERHEDGE, for example Claude Code or ChatGPT, and remove any tools that were not used. Do not imply that AI-generated code was fully reviewed or tested unless that review or testing actually occurred.

## 14. Security and Limitations

HYPERHEDGE is an experimental testnet prototype, not a production-ready insurance product.

Important limitations include:

- The contracts have not undergone an independent security audit.
- Testnet tokens have no monetary value.
- The current host demonstration does not establish real GPU workload quality or correctness.
- The oracle and signer infrastructure introduces trust assumptions.
- The demonstration signers are controlled by one operator rather than independent organizations.
- External compute-provider integration, production-grade evidence collection, and independent operational monitoring remain future work.
- Contract bugs, signer compromise, incorrect evidence, or integration failures could cause incorrect outcomes.

Do not use the prototype to secure production workloads or transfer assets of real value.

## 15. Roadmap

Potential next steps include:

- Integrate real compute providers and validate workload-specific delivery evidence.
- Separate oracle signers across independent operators.
- Improve dispute review and evidence availability.
- Add provider reputation and historical reliability information.
- Strengthen monitoring, threat modeling, and adversarial testing.
- Commission an independent smart contract security audit before any production deployment.

These are planned improvements, not claims about existing functionality.

## 16. External Dependencies and Attribution

HYPERHEDGE uses open-source frameworks, libraries, and tools listed in its package manifests and build configuration. Their respective authors and maintainers retain ownership of their work under their applicable licenses.

The project also uses Alchemy for Monad RPC connectivity. Monad and Alchemy are identified here as infrastructure providers; this does not imply sponsorship, endorsement, or partnership.

Any additional copied, adapted, or externally sourced code and assets must be attributed in accordance with their licenses. Review the repository's actual dependencies and included assets before final submission to ensure that this section is complete.

## 17. License

This project is intended to be released under the **MIT License**.

The repository must include a root-level `LICENSE` file containing the complete MIT License text and the correct copyright holder before the submission can claim to be MIT-licensed. Until that file is added, the license requirement is not satisfied merely by this README section.

## 18. Demo

**Live application:** https://hyperhedge-app.vercel.app/

**Demo video:** [Add the public URL of your final demo video here]

The final video should be no longer than three minutes and show the product operating, including real interactions with the deployed Monad testnet contracts. It should demonstrate the protection workflow and at least one settlement or failure scenario.

---

**HYPERHEDGE makes delivery risk a financial commitment that can be inspected, tested, and settled onchain.**
