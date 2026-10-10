"use client";

/**
 * Accounts, built on Mera (passkey -> PRF -> plain EOAs, no seed phrase).
 *
 *   passkey (Face ID / Touch ID)
 *     └─ PRF output (32 bytes) -> BIP-39 entropy -> BIP-32 m/44'/60'/0'/0/i
 *          ├─ i = 0       main account: holds AUSD, signs the buy-in and the gas-drip request
 *          └─ i = roomId  room key: holds only this room's buy-in, signs every bet silently
 *
 * One Face ID prompt at join derives both. The main session is ended right after the buy-in;
 * only the room session stays in memory, so a leaked room key can lose at most that buy-in.
 * Nothing derived from the passkey is ever written to storage.
 */
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { env } from "./env";

const CREDENTIAL_KEY = "pitchside.credential";
const DEVICE_KEY = "pitchside.device-key";
const MAIN_INDEX = 0;
/** BIP-32 non-hardened indexes stop at 2^31 - 1; room ids are far below that. */
const MAX_INDEX = 0x7fff_ffff;

export interface KeyPair {
  kind: "passkey" | "device";
  main: LocalAccount;
  room: LocalAccount;
  /** zeroes the main key; the room key stays for betting */
  endMain: () => void;
}

const roomSessions = new Map<string, { account: LocalAccount; end: () => void }>();

function deriveKey(prfOutput: Uint8Array, index: number): Uint8Array {
  if (index < 0 || index > MAX_INDEX) throw new Error(`key index out of range: ${index}`);
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("derivation produced no key");
  return node.privateKey;
}

function open(session: Secp256k1SigningSession) {
  return { account: toViemAccount(session) as LocalAccount, end: () => session.end() };
}

export function hasPasskey(): boolean {
  try {
    return localStorage.getItem(CREDENTIAL_KEY) !== null;
  } catch {
    return false;
  }
}

async function prf(): Promise<Uint8Array> {
  const rpId = location.hostname;
  let known: { credentialId: string; transports?: string[] } | undefined;
  try {
    const stored = localStorage.getItem(CREDENTIAL_KEY);
    known = stored ? JSON.parse(stored) : undefined;
  } catch {
    known = undefined;
  }

  if (!known) {
    const created = await createPasskeyWithPrfOutput({
      rp: { id: rpId, name: "Pitchside" },
      user: { name: "pitchside-player", displayName: "Pitchside player" },
    });
    remember({ credentialId: created.credentialId, transports: created.transports });
    return created.prfOutput;
  }

  const got = await getPasskeyPrfOutput({ rpId, credential: known as never });
  if (got.credentialId !== known.credentialId) remember({ credentialId: got.credentialId });
  return got.prfOutput;
}

function remember(v: unknown) {
  try {
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(v));
  } catch {
    // private mode: the passkey still works, the browser just asks which one next time
  }
}

/** One biometric prompt -> main + room accounts. */
export async function unlock(roomId: bigint): Promise<KeyPair> {
  const index = Number(roomId);
  if (env.accountMode === "device") return deviceKeys(roomId);
  try {
    const out = await prf();
    const main = open(createSecp256k1SigningSession({ privateKey: deriveKey(out, MAIN_INDEX) }));
    const room = open(createSecp256k1SigningSession({ privateKey: deriveKey(out, index) }));
    out.fill(0);
    roomSessions.get(roomId.toString())?.end();
    roomSessions.set(roomId.toString(), room);
    return { kind: "passkey", main: main.account, room: room.account, endMain: main.end };
  } catch (err) {
    if (isMeraError(err) && err.code === "PRF_UNAVAILABLE" && env.accountMode === "passkey-or-device") {
      return deviceKeys(roomId);
    }
    throw err;
  }
}

/**
 * Dev-only fallback when the passkey provider has no PRF (e.g. desktop Chrome without
 * Google Password Manager). The key lives in this browser only and the UI labels it so.
 */
function deviceKeys(roomId: bigint): KeyPair {
  let key = localStorage.getItem(DEVICE_KEY) as `0x${string}` | null;
  if (!key) {
    key = generatePrivateKey();
    localStorage.setItem(DEVICE_KEY, key);
  }
  const account = privateKeyToAccount(key);
  roomSessions.set(roomId.toString(), { account, end: () => {} });
  return { kind: "device", main: account, room: account, endMain: () => {} };
}

export function roomAccount(roomId: bigint): LocalAccount | undefined {
  return roomSessions.get(roomId.toString())?.account;
}

export function endRoom(roomId: bigint) {
  roomSessions.get(roomId.toString())?.end();
  roomSessions.delete(roomId.toString());
}

export function describeAccountError(err: unknown): string {
  if (!isMeraError(err)) return err instanceof Error ? err.message : "Something went wrong.";
  switch (err.code) {
    case "PRF_UNAVAILABLE":
      return "This passkey app can't derive keys. On iPhone use iCloud Keychain; on desktop Chrome, save the passkey to Google Password Manager.";
    case "PASSKEY_OPERATION_FAILED":
      return "Face ID was cancelled. Try again.";
    case "CRYPTO_UNAVAILABLE":
      return "Open Pitchside over HTTPS.";
    case "SESSION_ENDED":
      return "Your session ended. Unlock again.";
    default:
      return "Passkey error.";
  }
}
