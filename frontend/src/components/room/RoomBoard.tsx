"use client";

import {
  LOCK_DELAY_SECONDS,
  OUTCOME_LABEL,
  Outcome,
  RoomMode,
  projectPayout,
  type Pick,
} from "@pitchside/sdk";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import { useGame } from "@/hooks/use-game";
import { useNow } from "@/hooks/use-poll";
import { useRoom } from "@/hooks/use-room";
import { describeAccountError, roomAccount, unlock } from "@/lib/accounts";
import { cashOut, joinRoom, placeBet, waitFor } from "@/lib/actions";
import { txUrl } from "@/lib/chain";
import { authVerb, env, isConfigured } from "@/lib/env";
import { chipFormatter, signed } from "@/lib/format";
import { recallRoomAddress, rememberRoomAddress } from "@/lib/room-key-memory";
import { Scoreboard } from "../scoreboard/Scoreboard";
import { StrikeZone, type ZonePitch } from "../strike-zone/StrikeZone";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import { BetSizer, amountFor, type SizeKey } from "./BetSizer";
import { JoinPanel } from "./JoinPanel";
import { OutcomePads } from "./OutcomePads";
import { PlateTray } from "./PlateTray";
import { Standings } from "./Standings";
import styles from "./RoomBoard.module.css";

interface Call {
  seq: number;
  outcome: Pick;
  amount: bigint;
  status: "sending" | "sent" | "failed";
  hash?: Hash;
  error?: string;
}

export function RoomBoard({ roomId }: { roomId: bigint }) {
  const [me, setMe] = useState<Address | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [joining, setJoining] = useState<{ step: string } | undefined>(undefined);
  const [joinError, setJoinError] = useState<string>();
  const [size, setSize] = useState<SizeKey>("medium");
  const [call, setCall] = useState<Call>();
  const [shared, setShared] = useState(false);
  const [cashing, setCashing] = useState<{ busy: boolean; text: string }>();

  useEffect(() => {
    const live = roomAccount(roomId);
    setMe(live?.address ?? recallRoomAddress(roomId));
    setUnlocked(Boolean(live));
  }, [roomId]);

  const { data: room, error: roomError } = useRoom(roomId, me);
  const { data: game } = useGame(room?.gamePk);
  const now = useNow(10);
  const fmt = useMemo(() => chipFormatter(room?.mode ?? RoomMode.POINTS), [room?.mode]);

  // ── derived game state ──
  const secsLeft = room ? room.lockAt - now : 0;
  const open = Boolean(room?.gameOpen && room.lockAt > 0 && secsLeft > 0);
  const remaining = open ? Math.min(1, secsLeft / LOCK_DELAY_SECONDS) : room?.gameOpen ? 0 : undefined;
  const zonePitches: ZonePitch[] = useMemo(() => {
    const ps = game?.pitches ?? [];
    const last = ps[ps.length - 1];
    if (!last) return [];
    return ps
      .filter((p) => p.atBatIndex === last.atBatIndex && p.pX !== undefined && p.pZ !== undefined)
      .map((p, i) => ({ seq: p.seq, n: i + 1, outcome: p.outcome, pX: p.pX!, pZ: p.pZ! }));
  }, [game?.pitches]);
  const latestFeedPitch = game?.pitches[game.pitches.length - 1];

  const myCall = call && room && call.seq === room.openSeq ? call : undefined;
  const pickedOnChain = room?.myBet?.outcome as Pick | undefined;

  // ── actions ──
  const doJoin = useCallback(
    async (buyIn: bigint) => {
      if (!room) return;
      setJoinError(undefined);
      setJoining({ step: env.accountMode === "device" ? "Unlocking" : "Waiting for Face ID" });
      try {
        const keys = await unlock(roomId);
        rememberRoomAddress(roomId, keys.room.address);
        setMe(keys.room.address);
        setJoining({ step: room.mode === RoomMode.STAKES ? "Moving your buy-in" : "Getting your chips" });
        await joinRoom({ main: keys.main, room: keys.room, roomId, mode: room.mode, buyIn });
        keys.endMain();
        setUnlocked(true);
      } catch (err) {
        setJoinError(describeAccountError(err));
      } finally {
        setJoining(undefined);
      }
    },
    [room, roomId],
  );

  const doUnlock = useCallback(async () => {
    setJoinError(undefined);
    setJoining({ step: env.accountMode === "device" ? "Unlocking" : "Waiting for Face ID" });
    try {
      const keys = await unlock(roomId);
      keys.endMain();
      rememberRoomAddress(roomId, keys.room.address);
      setMe(keys.room.address);
      setUnlocked(true);
    } catch (err) {
      setJoinError(describeAccountError(err));
    } finally {
      setJoining(undefined);
    }
  }, [roomId]);

  const doPick = useCallback(
    async (outcome: Pick) => {
      const account = roomAccount(roomId);
      if (!room || !account || !open) return;
      const amount = amountFor(room.myChips + (room.myBet?.amount ?? 0n), size);
      if (amount === 0n) return;
      const seq = room.openSeq;
      setCall({ seq, outcome, amount, status: "sending" });
      try {
        const hash = await placeBet(account, roomId, seq, outcome, amount);
        setCall({ seq, outcome, amount, status: "sent", hash });
        await waitFor(hash, "Bet");
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : "Bet failed";
        setCall({ seq, outcome, amount, status: "failed", error: msg });
      }
    },
    [open, room, roomId, size],
  );

  const doShare = useCallback(async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Pitchside room", text: "Call the next pitch with me", url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2_000);
    } catch {
      // user dismissed the share sheet
    }
  }, []);

  const doCashOut = useCallback(async () => {
    if (!roomAccount(roomId)) return;
    setCashing({ busy: true, text: "Waiting for Face ID" });
    try {
      const keys = await unlock(roomId);
      setCashing({ busy: true, text: "Sending to your account" });
      await cashOut(keys.room, roomId, keys.main.address);
      keys.endMain();
      setCashing(undefined);
    } catch (err) {
      setCashing({ busy: false, text: describeAccountError(err) });
    }
  }, [roomId]);

  // ── result of the pitch that just happened ──
  const result = useMemo(() => {
    const last = room?.last;
    if (!last || !last.myBet || last.outcome === Outcome.NONE) return undefined;
    const { payout, refunded } = projectPayout(last.pot, last.myBet.outcome, last.outcome, last.myBet.amount, room.rakeBps);
    return {
      seq: last.seq,
      outcome: last.outcome,
      settled: last.settled,
      refunded,
      net: payout - last.myBet.amount,
    };
  }, [room]);

  // ── render ──
  if (!isConfigured) {
    return (
      <Shell>
        <p className={styles.notice}>
          This build has no contract addresses. Set NEXT_PUBLIC_PITCH_ORACLE and NEXT_PUBLIC_PITCHSIDE_ROOMS.
        </p>
      </Shell>
    );
  }
  if (roomError && !room) {
    return (
      <Shell>
        <p className={styles.notice}>
          {roomError.message === "Room not found" ? `Room ${roomId} doesn't exist.` : "Can't reach Monad right now. Retrying."}
        </p>
      </Shell>
    );
  }
  if (!room) {
    return (
      <Shell>
        <div className={styles.loading} aria-busy="true" />
      </Shell>
    );
  }

  const zoneLabel = room.gameClosed
    ? "Game over. Every market is settled or refunded."
    : !room.gameOpen
      ? "Calls open when the relayer opens this game."
      : open
        ? `Pitch ${room.openSeq} · ${Math.max(0, secsLeft).toFixed(1)}s to call`
        : `Pitch ${room.openSeq} · calls locked, waiting for the pitch`;

  return (
    <Shell onShare={doShare} shared={shared}>
      {game ? <Scoreboard snap={game.snap} /> : <div className={styles.scoreSkeleton} />}

      <div className={styles.stage}>
        <div className={styles.zoneCol}>
          <StrikeZone
            pitches={zonePitches}
            zoneTop={latestFeedPitch?.zoneTop}
            zoneBottom={latestFeedPitch?.zoneBottom}
            remaining={remaining}
            state={open ? "open" : room.gameOpen ? "locked" : "idle"}
            label={zoneLabel}
          />
          <div className={styles.resultSlot} aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {result && (
                <motion.p
                  key={result.seq}
                  className={styles.result}
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  exit={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                >
                  <span className={styles.resultWord} data-outcome={result.outcome}>
                    {OUTCOME_LABEL[result.outcome]}
                  </span>
                  <span className="num">
                    {result.refunded
                      ? "Refunded"
                      : !result.settled
                        ? room.mode === RoomMode.STAKES
                          ? "Waiting on Chainlink"
                          : "Settling"
                        : result.net >= 0n
                          ? `You won ${signed(result.net, fmt)}`
                          : `You lost ${fmt(-result.net)}`}
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className={styles.playCol}>
          {!room.isPlayer ? (
            <JoinPanel
              mode={room.mode}
              players={room.players}
              busy={Boolean(joining)}
              step={joining?.step}
              error={joinError}
              onJoin={doJoin}
            />
          ) : (
            <PlateTray>
              <div className={styles.stackRow}>
                <span className={styles.stackLabel}>Your stack</span>
                <span className={`${styles.stack} num`}>{fmt(room.myChips)}</span>
              </div>
              <OutcomePads
                pot={room.pot}
                picked={myCall?.status === "sending" ? undefined : (pickedOnChain ?? myCall?.outcome)}
                pending={myCall?.status === "sending" ? myCall.outcome : undefined}
                disabled={!open || !unlocked}
                format={fmt}
                onPick={doPick}
              />
              <BetSizer stack={room.myChips + (room.myBet?.amount ?? 0n)} value={size} onChange={setSize} format={fmt} />
              <p className={styles.callLine} aria-live="polite">
                {!unlocked ? (
                  <Button tone="quiet" onClick={doUnlock} busy={Boolean(joining)}>
                    {`Unlock${authVerb} to call pitches`}
                  </Button>
                ) : myCall?.status === "failed" ? (
                  <span className={styles.error}>{myCall.error}</span>
                ) : room.myBet ? (
                  <>
                    {OUTCOME_LABEL[room.myBet.outcome]} for {fmt(room.myBet.amount)}.{" "}
                    {open ? "Tap another call to switch." : "Locked in."}
                    {myCall?.hash && txUrl(myCall.hash) && (
                      <a className={styles.tx} href={txUrl(myCall.hash)} target="_blank" rel="noreferrer">
                        tx
                      </a>
                    )}
                  </>
                ) : open ? (
                  "Tap a call. It's placed the moment you tap."
                ) : (
                  "Calls reopen right after this pitch."
                )}
              </p>
              {joinError && unlocked === false && <span className={styles.error}>{joinError}</span>}
              {env.accountMode === "device" && (
                <span className={styles.devNote}>Dev build: device key in this browser, not a passkey.</span>
              )}
            </PlateTray>
          )}

        </div>

        <section className={styles.table} aria-labelledby="table-title">
          <div className={styles.tableHead}>
            <h2 id="table-title">Room {roomId.toString()}</h2>
            <span>{room.mode === RoomMode.STAKES ? "Stakes · AUSD" : "Points · free play"}</span>
          </div>
          <Standings rows={room.standings} me={me} host={room.host} format={fmt} />
          {room.mode === RoomMode.STAKES && room.isPlayer && room.myChips > 0n && unlocked && (
            <Button tone="quiet" onClick={doCashOut} busy={cashing?.busy}>
              {cashing?.text ?? "Cash out to your account"}
            </Button>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children, onShare, shared }: { children: React.ReactNode; onShare?: () => void; shared?: boolean }) {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Wordmark />
        {onShare && (
          <button type="button" className={styles.share} onClick={onShare}>
            {shared ? "Link ready" : "Invite friends"}
          </button>
        )}
      </nav>
      {children}
    </main>
  );
}
