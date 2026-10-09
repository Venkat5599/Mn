# Pitchside

**Bet your friends on every pitch.** Open a room for a live MLB game and send the link. Before every pitch, everyone calls it: ball, strike, foul or in play. Calls lock 8 seconds after the last pitch, and the room's pot pays out on Monad before the next one is thrown.

Built for Monad Metropolis 2026. Points rooms are free play. Stakes rooms use AUSD and are off wherever real-money play is not allowed. Contracts are **not audited**.

## Why it only works on Monad

The gap between two pitches in a real playoff game is a median of 16.7 seconds. The next pitch starts at least 8.7s after the last one ends 99% of the time (measured on gamePk 849834, 294 pitches). Inside that gap a market has to open, take bets, lock and settle. An 8-second calling window is about 26 Monad blocks at 300ms. On Ethereum it is less than one.

## How a pitch settles

```
MLB feed ──► relayer ──reportPitch──► PitchOracle ◄──onReport── Chainlink CRE (DON re-fetches the pitch)
                │                          │
                └──settle (keeper)──► PitchsideRooms ◄── bet / join / cashOut ── phone (Mera passkey, room key)
```

1. The relayer posts pitch *n*, which opens market *n+1* with `lockAt = end(n) + 8s`.
2. Players tap a call. The per-room key signs it silently, with no Face ID per bet.
3. The keeper settles every room's market *n*. Points rooms settle on the fast report. Stakes rooms settle only once CRE confirms.
4. Every DON node fetches the pitch by `playId` and maps the call with the **same code** as the relayer. If the two sources disagree, the pitch is voided and refunded.
5. A bet stamped at or after the pitch's real start time is refunded, whatever the reason (courtsiding, feed lag).

## Repository

```
contracts/            Foundry: PitchOracle, PitchsideRooms, MockAUSD, tests, Deploy script
packages/shared/      One source of truth: outcome enum, MLB call mapping, feed flattening,
                      CRE confirmation logic, payout math, chains, gas limits, generated ABIs
apps/relayer/         bun: feed watcher, oracle reporter, settle keeper, CRE trigger, MON drip
  scripts/replay.ts   end-to-end replay of a real recorded game on anvil
  scripts/dev-local.ts  local stack with a time-shifted replay game and bot friends
apps/cre-workflow/    Chainlink CRE workflow (HTTP trigger + cron sweep) writing to PitchOracle
apps/indexer/         Envio HyperIndex: standings, streaks, room feed, latency stats
apps/web/             Next.js PWA: home, create room, room board (strike zone, pads, standings)
fixtures/mlb/         a real finished game feed (trimmed to the fields Pitchside reads)
scripts/              ABI generator, demo at-bat extractor
docs/                 PRD and architecture
```

## Run it

Requires [bun](https://bun.sh) 1.3+ and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run setup               # forge-std + OpenZeppelin into contracts/lib
bun run abi                 # build contracts, regenerate typed ABIs
bun run test                # shared + relayer unit tests, then forge tests
bun run replay              # real game, real contracts, local chain: must print "replay PASS"
```

**Local app with a simulated game** (a replay of a finished game, labelled as such in the UI):

```bash
bun run dev:local           # anvil + contracts + replayed feed + relayer + drip + 3 bot friends
bun run dev:web             # http://localhost:3000
```

`dev:local` writes `apps/web/.env.local` with `NEXT_PUBLIC_ACCOUNT_MODE=device`, so the app uses a browser-only key and says so on screen. Passkeys need a real device. Use `passkey` mode over HTTPS on an iPhone with iCloud Keychain, or on Android or desktop Chrome with Google Password Manager.

**Testnet**

```bash
cd contracts
RELAYER_ADDRESS=0x... CRE_FORWARDER=0x... AUSD_ADDRESS=0x... \
  forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
# write deployments/10143.json, then:
cp apps/relayer/.env.example apps/relayer/.env    # fill in RPC, key, GAME_PK
bun run dev:relayer
```

If `AUSD_ADDRESS` is unset, a test-only MockAUSD is deployed. The deploy script refuses to do that on mainnet.

## Verified in this repo

| Check | Result |
|---|---|
| Foundry unit, fuzz (512 runs), chip-conservation invariant (8,192 calls) and 32-player gas budget | 51 / 51 pass |
| Shared mapping, feed, confirmation and payout tests on the real game | 16 / 16 pass |
| Full replay of gamePk 849834 on anvil | 294 pitches reported and CRE-confirmed, 2,640 bets, 588 markets settled, stake tokens conserved |
| Web production build | passes |
| Browser flow (home, create room, join, call, result) in headless Chrome at 390px and 1440px | passes, no console errors, no horizontal overflow |

## Not done yet, stated plainly

- **Not run on Monad testnet yet.** Everything above ran on a local anvil.
- **CRE workflow is typechecked, not compiled or simulated.** The CRE CLI is not installed here. The HTTP trigger also needs signed requests from an authorized key, so the relayer's trigger call has to go through the CRE gateway. Until that is wired, the cron sweep is the confirmation path. If CRE cannot write to Monad in time, run `cre workflow simulate` and label confirmations "CRE-simulated", never live.
- **Envio indexer is written but not code-generated or run.** The app does not depend on it: standings come from chain reads.
- **Passkey flow not tested on a phone.** It follows Mera's documented API (`@category-labs/mera` 0.2.0).
- **MLB Stats API terms are non-commercial.** Fine for a demo; production needs a licensed feed.
