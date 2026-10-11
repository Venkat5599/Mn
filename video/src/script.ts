/** Every line the narrator says, one entry per scene. Numbers are the real ones from the testnet runs. */
export type Scene = { id: string; say: string; rate?: string };

export const PITCH: Scene[] = [
  { id: "team", say: "Hi, I'm Venkat. I built HYPERHEDGE, solo, for Monad Metropolis." },
  {
    id: "problem",
    say: "AI teams now prepay for GPU capacity, weeks in advance. When a provider under-delivers, the buyer carries the whole loss, and the only remedy is credits from the same provider that just failed them. Today, there is no way to hedge that risk.",
  },
  {
    id: "solution",
    say: "HYPERHEDGE turns compute delivery risk into a contract with a price. The buyer pays a premium. The seller locks the full payout as collateral before the contract can even exist, so protection can never go unpaid.",
  },
  {
    id: "proof",
    say: "Delivery is proven, not claimed. Every fifteen seconds, our oracle challenges the host with a seed from a fresh Monad block hash. The host must find a proof of work, about a million hashes, and answer in time. Every miss becomes evidence.",
  },
  {
    id: "settle",
    say: "After the deadline, two of three signers report onchain, and anyone can re-check every proof in their own browser. If the host failed, the buyer is paid from the collateral. A seller who disputes a valid failure loses their bond to the buyers.",
  },
  {
    id: "monad",
    say: "This needs a fast chain. With Monad's sub-second blocks, a fresh challenge every few seconds is cheap enough to be the default.",
  },
  {
    id: "live",
    say: "It's live on Monad testnet today: delivered, failed, and disputed contracts from fresh wallets, sixty-nine passing tests, a price protection pool, and an order book for positions.",
  },
  {
    id: "why",
    say: "I'm building this because compute is becoming the most important commodity in the world, and every commodity needs a hedge. HYPERHEDGE. Protection for the compute you paid for.",
  },
];

export const AD: Scene[] = [
  { id: "hook", say: "Paid for GPUs that never showed up?", rate: "+6%" },
  { id: "lock", say: "HYPERHEDGE locks the payout before you buy.", rate: "+6%" },
  { id: "prove", say: "Proofs check delivery every fifteen seconds, on Monad.", rate: "+6%" },
  { id: "pay", say: "Host fails? You get paid. Automatically.", rate: "+6%" },
  { id: "end", say: "HYPERHEDGE. Hedge your compute.", rate: "+2%" },
];
