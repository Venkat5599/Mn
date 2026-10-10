import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
} from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { chainById } from "@pitchside/sdk";
import { log } from "./log";

export interface Chainish {
  pub: PublicClient<Transport, Chain>;
  wallet: WalletClient<Transport, Chain, Account>;
  account: Account;
}

export function connect(chainId: number, rpcUrl: string, privateKey: Hex, pollingInterval = 250): Chainish {
  const chain = chainById(chainId);
  const transport = http(rpcUrl, { batch: false, retryCount: 2, timeout: 8_000 });
  const account = privateKeyToAccount(privateKey, { nonceManager });
  return {
    pub: createPublicClient({ chain, transport, pollingInterval }),
    wallet: createWalletClient({ chain, transport, account }),
    account,
  };
}

/**
 * Simulates, then sends with an explicit gas limit (Monad bills the limit, not usage).
 * Simulating first means a doomed transaction costs nothing.
 */
export async function write<
  const abi extends Abi,
  name extends ContractFunctionName<abi, "nonpayable" | "payable">,
  args extends ContractFunctionArgs<abi, "nonpayable" | "payable", name>,
>(
  c: Chainish,
  params: { address: Address; abi: abi; functionName: name; args: args; gas: bigint; label: string },
): Promise<Hex> {
  const { request } = await c.pub.simulateContract({
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    account: c.account,
    gas: params.gas,
  } as never);
  const hash = await c.wallet.writeContract({ ...(request as object), gas: params.gas } as never);
  log.debug("tx sent", { label: params.label, hash });
  return hash;
}

export async function confirm(c: Chainish, hash: Hex, label: string) {
  const r = await c.pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
  if (r.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  return r;
}
