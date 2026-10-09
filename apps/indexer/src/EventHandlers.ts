/**
 * Envio HyperIndex handlers. Builds what the app shows besides live chain state:
 * season standings, streaks, the room feed and the settlement latency stats in the README.
 * Entity types come from `envio codegen` (schema.graphql).
 */
import { PitchOracle, PitchsideRooms, type Player, type Room } from "generated";

const OUTCOME_POT = ["", "potBall", "potStrike", "potFoul", "potInPlay"] as const;

const playerId = (roomId: bigint, addr: string) => `${roomId}-${addr.toLowerCase()}`;
const marketId = (roomId: bigint, gamePk: bigint, seq: bigint) => `${roomId}-${gamePk}-${seq}`;
const pitchId = (gamePk: bigint, seq: bigint) => `${gamePk}-${seq}`;
const feedId = (e: { block: { number: number }; logIndex: number }) => `${e.block.number}-${e.logIndex}`;

function newPlayer(room: Room, address: string): Player {
  return {
    id: playerId(BigInt(room.id), address),
    room_id: room.id,
    address: address.toLowerCase(),
    deposited: 0n,
    wagered: 0n,
    won: 0n,
    net: 0n,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
  };
}

// ───────────── rooms ─────────────

PitchsideRooms.RoomCreated.handler(async ({ event, context }) => {
  context.Room.set({
    id: event.params.roomId.toString(),
    host: event.params.host.toLowerCase(),
    mode: Number(event.params.mode),
    gamePk: Number(event.params.gamePk),
    playerCount: 0,
    marketsSettled: 0,
    handle: 0n,
  });
});

PitchsideRooms.GameSet.handler(async ({ event, context }) => {
  const room = await context.Room.get(event.params.roomId.toString());
  if (room) context.Room.set({ ...room, gamePk: Number(event.params.gamePk) });
});

PitchsideRooms.Joined.handler(async ({ event, context }) => {
  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;
  const id = playerId(event.params.roomId, event.params.player);
  const existing = await context.Player.get(id);
  const player = existing ?? newPlayer(room, event.params.player);
  if (!existing) context.Room.set({ ...room, playerCount: room.playerCount + 1 });
  context.Player.set({ ...player, deposited: player.deposited + event.params.credited });
  context.FeedItem.set({
    id: feedId(event),
    room_id: room.id,
    kind: "joined",
    player: player.address,
    gamePk: room.gamePk,
    seq: undefined,
    amount: event.params.credited,
    streak: undefined,
    at: event.block.timestamp,
  });
});

// ───────────── bets + settlement ─────────────

PitchsideRooms.BetPlaced.handler(async ({ event, context }) => {
  const { roomId, gamePk, seq, outcome, amount } = event.params;
  const id = marketId(roomId, gamePk, seq);
  const market = (await context.Market.get(id)) ?? {
    id,
    room_id: roomId.toString(),
    gamePk: Number(gamePk),
    seq: Number(seq),
    pot: 0n,
    potBall: 0n,
    potStrike: 0n,
    potFoul: 0n,
    potInPlay: 0n,
    bettors: 0,
    outcome: 0,
    rake: 0n,
    settledAt: undefined,
    settleLatencySec: undefined,
  };
  // Re-bets replace the earlier bet on chain; the authoritative pot is fixed at MarketSettled.
  const key = OUTCOME_POT[Number(outcome)];
  context.Market.set({
    ...market,
    bettors: market.bettors + 1,
    ...(key ? { [key]: (market[key] as bigint) + amount } : {}),
  });
});

PitchsideRooms.BetResolved.handler(async ({ event, context }) => {
  const { roomId, gamePk, seq, player: addr, amount, payout, refunded } = event.params;
  if (refunded) return;
  const room = await context.Room.get(roomId.toString());
  if (!room) return;
  const player = (await context.Player.get(playerId(roomId, addr))) ?? newPlayer(room, addr);
  const won = payout > 0n;
  const streak = won ? player.streak + 1 : 0;
  context.Player.set({
    ...player,
    wagered: player.wagered + amount,
    won: player.won + payout,
    net: player.net + payout - amount,
    wins: player.wins + (won ? 1 : 0),
    losses: player.losses + (won ? 0 : 1),
    streak,
    bestStreak: Math.max(player.bestStreak, streak),
  });
  context.Room.set({ ...room, handle: room.handle + amount });
  if (won && (streak === 3 || streak === 5 || streak >= 8)) {
    context.FeedItem.set({
      id: feedId(event),
      room_id: room.id,
      kind: "streak",
      player: player.address,
      gamePk: Number(gamePk),
      seq: Number(seq),
      amount: payout,
      streak,
      at: event.block.timestamp,
    });
  }
});

PitchsideRooms.MarketSettled.handler(async ({ event, context }) => {
  const { roomId, gamePk, seq, outcome, pot, rake } = event.params;
  const market = await context.Market.get(marketId(roomId, gamePk, seq));
  const pitch = await context.Pitch.get(pitchId(gamePk, seq));
  const room = await context.Room.get(roomId.toString());
  if (market) {
    context.Market.set({
      ...market,
      pot,
      rake,
      outcome: Number(outcome),
      settledAt: event.block.timestamp,
      settleLatencySec: pitch ? event.block.timestamp - pitch.endTs : undefined,
    });
  }
  if (room) context.Room.set({ ...room, marketsSettled: room.marketsSettled + 1 });
});

PitchsideRooms.CashedOut.handler(async ({ event, context }) => {
  context.FeedItem.set({
    id: feedId(event),
    room_id: event.params.roomId.toString(),
    kind: "cashout",
    player: event.params.player.toLowerCase(),
    gamePk: undefined,
    seq: undefined,
    amount: event.params.amount,
    streak: undefined,
    at: event.block.timestamp,
  });
});

// ───────────── oracle ─────────────

PitchOracle.PitchReported.handler(async ({ event, context }) => {
  const { gamePk, seq, outcome, startTs, endTs } = event.params;
  context.Pitch.set({
    id: pitchId(gamePk, seq),
    gamePk: Number(gamePk),
    seq: Number(seq),
    fast: Number(outcome),
    confirmed: 0,
    matched: undefined,
    voided: Number(outcome) === 5,
    startTs: Number(startTs),
    endTs: Number(endTs),
    reportedAt: event.block.timestamp,
    reportLatencySec: event.block.timestamp - Number(endTs),
    confirmedAt: undefined,
  });
});

PitchOracle.PitchConfirmed.handler(async ({ event, context }) => {
  const p = await context.Pitch.get(pitchId(event.params.gamePk, event.params.seq));
  if (!p) return;
  context.Pitch.set({
    ...p,
    confirmed: event.params.matched ? Number(event.params.reported) : 5,
    matched: event.params.matched,
    voided: p.voided || !event.params.matched,
    confirmedAt: event.block.timestamp,
  });
});

PitchOracle.PitchVoided.handler(async ({ event, context }) => {
  const p = await context.Pitch.get(pitchId(event.params.gamePk, event.params.seq));
  if (p) context.Pitch.set({ ...p, confirmed: 5, voided: true });
});
