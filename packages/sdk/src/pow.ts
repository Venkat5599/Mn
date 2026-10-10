import { concat, encodeAbiParameters, hexToBytes, keccak256, sha256, toHex, type Hex } from "viem";

/**
 * Proof-of-work delivery receipts. The oracle issues a seed that could not exist before a given block;
 * the host must find a nonce with sha256(seed ‖ nonce) carrying `difficultyBits` leading zero bits.
 * Producing one costs ~2^difficultyBits hashes of real compute on the host. Checking one costs a single
 * hash, so anyone can re-verify every receipt.
 */

/** nonce is a uint64, big-endian, appended to the 32-byte seed */
export function powHash(seed: Hex, nonce: bigint): Hex {
  return sha256(concat([seed, toHex(nonce, { size: 8 })]));
}

export function leadingZeroBits(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

export function checkPow(seed: Hex, nonce: bigint, difficultyBits: number): boolean {
  if (nonce < 0n || nonce >= 2n ** 64n) return false;
  return leadingZeroBits(hexToBytes(powHash(seed, nonce))) >= difficultyBits;
}

/**
 * Challenge seed bound to a block: it cannot be computed before `blockHash` exists, so a host cannot
 * precompute answers, and anyone can check the block on chain.
 */
export function deriveSeed(contractId: bigint, index: number, blockHash: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint32" }, { type: "bytes32" }],
      [contractId, index, blockHash],
    ),
  );
}

/** Expected hashes to solve one challenge. */
export const expectedWork = (difficultyBits: number) => 2 ** difficultyBits;
