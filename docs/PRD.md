# Pitchside PRD

**One-liner:** Bet your friends on every pitch.
**Hackathon:** Monad Metropolis 2026. Primary track: Social, Attention & Culture. Fallback: Consumer Products & Payments.
**Deadline:** 13 Oct 2026, 11:59 PM ET.
**Status:** v1.0, 9 Oct 2026.

---

## 1. What changed from the raw idea (the fixes)

| # | Weakness in the raw idea | Fix |
|---|---|---|
| 1 | Real-money sports betting is regulated, which scares judges | **Two modes, one contract.** *Points* mode is free, uses non-transferable chips and is the default everywhere. *Stakes* mode uses AUSD and is a room-creator setting, geofenced in the product and off for US IPs. The demo runs both. |
| 2 | Signing every bet with Face ID inside a 6s window is too slow | **Chip-stack key.** Face ID once at join derives a per-room key (Mera "many keys", HD index = room id). The main account sends the buy-in to it. Taps then sign silently from a session key that only ever holds the buy-in. The main key never stays in memory. |
| 3 | A new user has no MON for gas | **Gas drip.** The relayer sends the chip-stack key a small MON drip with the buy-in (rate-limited per passkey). Meta-transactions are a stretch goal. |
| 4 | Oracle trust: one server says "strike" | **Two-source oracle.** A fast relayer posts each pitch result. A Chainlink CRE workflow fetches the same pitch independently on the DON and confirms it onchain. Points settle at once; Stakes payouts are only withdrawable once CRE confirms. Mismatch = pitch voided and refunded. |
| 5 | Courtsiding: someone at the stadium sees the pitch before the feed | **Lock rule.** Betting closes `LOCK_DELAY = 6s` after the previous pitch ended. Real playoff data: next pitch starts ≥ 8.7s later 99% of the time. The oracle also reports each pitch's start time, and any bet with a timestamp at or after it is refunded. |
| 6 | Novelty fades after one game | **Room season.** Rooms persist across games with standings, streaks ("5 strikes called in a row"), and a room MVP each game. One link reopens the room for the next game. |
| 7 | Thin liquidity | Parimutuel inside the room, so friends are the liquidity. No house, no market maker, no seeding. |

---

## 2. Problem

- Live in-play betting is where retail sports money is. Kalshi did $983M on NFL in one week; Polymarket did $27.6M (Crypto Briefing, Sep 2026). Onchain is losing the mainstream sports fan.
- Every onchain attempt prices whole matches or rounds. Nobody prices **every pitch**, because a market that opens, locks and settles inside a ~16s gap needs sub-second blocks and sub-cent fees.
- Watching sports with friends already involves side bets ("bet you he strikes out"). They are settled by Venmo IOUs or not at all. YC startups that tried this (FameGame S18, GameDay S17, Playmaker) died on payments, onboarding and cold start.
- Short-window prediction markets die of thin liquidity: one 15-min Polymarket market traded only $47.3K.

## 3. Why now, why Monad

- **300ms blocks, 600ms finality** (MIP-12, Jul 2026). A 6s lock window is 20 Monad blocks; on Ethereum it is half a block.
- **Mera** (Aug 2026): a passkey is a plain EOA with no seed phrase, and one passkey derives many keys.
- **AUSD** is a native dollar on Monad.
- **Chainlink CRE** can fetch an offchain API on a DON and write onchain with consensus.

## 4. Users

**Primary persona: Dani, 26, watches every Dodgers playoff game in a group chat with 5 friends.**
- Already argues about every pitch call.
- Has never held crypto.
- Wants something to do during the 16 seconds between pitches.

**Secondary personas:**
- Japanese and LATAM baseball fans (Ohtani effect) where US sportsbooks don't operate.
- Watch-party hosts: bars, Discord servers, streamers.

**Launch wedge:** MLB postseason, Oct 2026. Later: cricket ball-by-ball (non-India), football corners and cards, F1 laps, esports.

## 5. Goals and success metrics (by submission)

| Goal | Metric | Target |
|---|---|---|
| Works live | Pitches settled onchain during real games | ≥ 250 across ≥ 2 games |
| Real users | Unique passkey users who placed a bet | ≥ 10 |
| Speed | Median time from pitch end to onchain settlement | < 5 s |
| Correctness | Settled outcomes matching the official feed | 100%; mismatches voided, not mis-paid |
| Onboarding | Time from tapping the link to first bet | < 45 s |

**Non-goals for the hackathon:** parlays, other sports, native app store build, fiat on-ramp, licensed data feed, house-backed odds.

## 6. User stories

1. As a host, I create a room for a game and get a share link in under 10s.
2. As a friend, I open the link, use Face ID, pick a buy-in (Points: free 1,000 chips; Stakes: $5 / $10 / $20 AUSD) and I'm in.
3. As a player, before every pitch I see a countdown ring and tap Ball, Strike, Foul or In play with my chip size.
4. As a player, I see the pitch result and my payout within seconds, before the next pitch.
5. As a player, I see the room standings, my streak and the pot history.
6. As a player, I cash out my chip stack back to my main account at any time between pitches.
7. As a player, if the feed was wrong or I bet after the pitch began, I get refunded automatically.
8. As a host, I reopen the same room for the next game and the season standings carry over.

## 7. Core flows

**Join**
1. Open the link and see the game, the room and the players.
2. Face ID: Mera derives the main account (index 0) and the room key (index = roomId).
3. Pick a buy-in. Main account sends AUSD to the room key; the relayer drips MON.
4. Room key calls `join(roomId)` and deposits chips.
5. Board.

**Pitch loop (every ~16s)**
1. Oracle reports pitch *n* result. This opens pitch *n+1* with `lockAt = endTs(n) + 6s`.
2. Players tap; the room key sends `bet(roomId, n+1, outcome, amount)`.
3. At `lockAt` the board freezes.
4. Pitch *n+1* happens. The oracle reports it, the keeper calls `settle(roomId, n+1)`, and the payout animation plays.

**Cash out:** `cashOut(roomId)` returns chips to the room key, and the app sweeps them to the main account.

## 8. Functional requirements

**Markets**
- One market per (game, pitch sequence number).
- Outcomes and mapping from MLB `details.call.description`:
  - **BALL:** Ball, Ball In Dirt, Intent Ball, Pitchout, Hit By Pitch, Automatic Ball
  - **STRIKE:** Called Strike, Swinging Strike, Swinging Strike (Blocked), Foul Tip, Missed Bunt, Automatic Strike
  - **FOUL:** Foul, Foul Bunt, Foul Pitchout
  - **IN_PLAY:** In play, out(s) / no out / run(s)
  - Anything unmapped: VOID, refund.

**Bets**
- One bet per player per pitch, editable until `lockAt`.
- Min 1 chip; max 25% of the player's stack.

**Settlement**
- Parimutuel, rake `rakeBps` (Points 0, Stakes 400).
- No winners: everyone refunded.
- Only one outcome had bets: refunded.

**Lock and void**
- Reject bets at or after `lockAt`.
- Refund bets with `ts >= startTs` of that pitch.
- Void if the relayer and CRE reports disagree.

**Rooms**
- Max 32 players.
- Persistent across games; the host sets `gamePk` per session.

**Oracle**
- Relayer posts within 2s of the feed update.
- CRE confirms within 60s.
- Stakes withdrawals of winnings wait for confirmation.

**Indexer:** standings, streaks, room feed and settlement latency stats.

## 9. Non-functional requirements

- Explicit `gas` on every transaction (Monad charges gas *limit*).
- Keep cold storage reads low: one storage slot per bet.
- Session key lives in memory only, is zeroed on cash-out or tab close, and holds the buy-in only.
- Mobile web first (PWA, iOS Safari + iCloud Keychain, Android Chrome + Google Password Manager). Desktop Chrome works only with Google Password Manager passkeys (Mera `PRF_UNAVAILABLE` otherwise).
- No invented data: empty states say "Next game: NLCS G2, Mon 12 Oct".

## 10. Design direction (short)

- **Signature artifact:** a living strike zone, the 3x3 zone drawn from the real pitch location (`pitchData.coordinates`) after each pitch.
- **Taps:** four big outcome pads under the zone, with a countdown ring around it.
- **Payout moment:** chips fly from the pot to the winners' avatars.
- Ballpark night palette (deep field green-black, chalk white, one warm floodlight tone).
- Follow the design law in CLAUDE.md at build time.

## 11. Bounties targeted

| Bounty | Why we qualify |
|---|---|
| Track (Social / Consumer), $10k per place | Markets on cultural outcomes, group play |
| Grand champion, $25k | Only entry settling hundreds of live markets per game |
| Chainlink CRE, $3k | CRE workflow is the confirming oracle, core to payouts |
| Mera-powered UX, $2.5k | Mera is the entire account layer |
| Mera: One Passkey, Many Keys, $2.5k | Per-room chip-stack keys with bounded blast radius |
| Envio, $1k | HyperIndex powers standings, streaks, feed |
| Alchemy credits | Monad RPC + WebSocket |

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Regulation (real-money wagering) | High | Points default, Stakes geofenced, demo leans on Points, say it plainly in the pitch |
| MLB Stats API terms (non-commercial) | High after launch | Fine for the demo; production licenses Sportradar or Genius. Named in the pitch |
| CRE latency or onboarding blocks D1 | Medium | Relayer path ships first; CRE confirms async; if CRE fails, ship it as a scripted simulation run plus the live relayer and say so |
| Mera PRF not available on judge device | Medium | Demo on iPhone + iCloud Keychain; record the video |
| AUSD not on Monad testnet | Medium | Verify D1. If missing, use mainnet with $1 to $5 stakes among the team, or Points only on testnet |
| Feed latency spikes | Low | Refund-after-start rule; settlement shows "waiting on feed" honestly |

## 13. Milestones

| Day | Date | Done when |
|---|---|---|
| D1 | Fri 9 to Sat 10 Oct | Contracts on Monad testnet; relayer settles **ALDS G5 (gamePk 849831)** live; CRE go/no-go |
| D2 | Sun 11 Oct | Mera join + board; **NLCS G1 played live with 3 to 5 real people** |
| D3 | Mon 12 Oct | Envio standings, CRE confirmations, polish; second live session (NLCS G2 / ALCS G1); **demo-ready** |
| D4 | Tue 13 Oct | Video from real sessions, README with tx links, submit before 11:59 PM ET |
