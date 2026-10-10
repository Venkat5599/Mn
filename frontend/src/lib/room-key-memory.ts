/**
 * Remembers WHICH address is your room key (public data only) so the board can show your stack
 * before you unlock with Face ID. Keys themselves never touch storage.
 */
const k = (roomId: bigint) => `pitchside.room.${roomId}.address`;

export function rememberRoomAddress(roomId: bigint, address: string) {
  try {
    localStorage.setItem(k(roomId), address);
  } catch {
    // storage unavailable: the board just asks you to unlock first
  }
}

export function recallRoomAddress(roomId: bigint): `0x${string}` | undefined {
  try {
    const v = localStorage.getItem(k(roomId));
    return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
  } catch {
    return undefined;
  }
}
