/** Spawns anvil and deploys the real contract artifacts. Shared by the replay and local dev. */
import { anvilLocal, mockAusdAbi, pitchOracleAbi, pitchsideRoomsAbi, type Deployment } from "@pitchside/sdk";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, toHex, type Abi, type Address, type Hex } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const ROOT = join(import.meta.dir, "../../../..");

/** anvil's default dev mnemonic (public, test only). Accounts are prefunded with 10,000 ETH. */
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

export const DEV_KEYS: Hex[] = Array.from({ length: 8 }, (_, i) => {
  const key = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i }).getHdKey().privateKey;
  if (!key) throw new Error("could not derive dev key");
  return toHex(key);
});

export async function rpc(url: string, method: string, params: unknown[] = []) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

export async function startAnvil(port: number, startTimestamp: number) {
  const proc = Bun.spawn(["anvil", "--port", String(port), "--timestamp", String(startTimestamp), "--silent"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      await rpc(url, "eth_chainId");
      return { url, stop: () => proc.kill() };
    } catch {
      await Bun.sleep(250);
    }
  }
  proc.kill();
  throw new Error("anvil did not start (is Foundry installed?)");
}

async function artifact(file: string, name: string) {
  const a = await Bun.file(join(ROOT, "contracts/out", file, `${name}.json`)).json();
  return a.bytecode.object as Hex;
}

export async function deployLocal(url: string, opts: { lockDelay: number; forwarder: Address }): Promise<Deployment> {
  const deployer = privateKeyToAccount(DEV_KEYS[0]!);
  const transport = http(url);
  const pub = createPublicClient({ chain: anvilLocal, transport });
  const wallet = createWalletClient({ chain: anvilLocal, transport, account: deployer });

  const deploy = async (abi: Abi, bytecode: Hex, args: unknown[]) => {
    const hash = await wallet.deployContract({ abi, bytecode, args } as never);
    const r = await pub.waitForTransactionReceipt({ hash });
    if (!r.contractAddress) throw new Error("deploy failed");
    return r.contractAddress;
  };

  const startBlock = Number(await pub.getBlockNumber());
  const token = await deploy(mockAusdAbi as Abi, await artifact("MockAUSD.sol", "MockAUSD"), []);
  const oracle = await deploy(pitchOracleAbi as Abi, await artifact("PitchOracle.sol", "PitchOracle"), [
    deployer.address,
    deployer.address, // relayer = deployer in local runs
    opts.forwarder,
    BigInt(opts.lockDelay),
  ]);
  const rooms = await deploy(pitchsideRoomsAbi as Abi, await artifact("PitchsideRooms.sol", "PitchsideRooms"), [
    deployer.address,
    oracle,
    token,
  ]);
  return {
    chainId: anvilLocal.id,
    pitchOracle: oracle,
    pitchsideRooms: rooms,
    stakeToken: token,
    mockStakeToken: true,
    startBlock,
  };
}
