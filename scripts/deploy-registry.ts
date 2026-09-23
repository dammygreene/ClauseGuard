import { readFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";

if (!privateKey) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local before deploying.");
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key.");

  const source = await readFile(path.join(process.cwd(), "contracts", "ClauseGuardRegistry.sol"), "utf8");
const input = {
  language: "Solidity",
  sources: { "ClauseGuardRegistry.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: { severity: string; formattedMessage: string }[];
  contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
};
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  const compiled = output.contracts["ClauseGuardRegistry.sol"].ClauseGuardRegistry;
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(rpcUrl);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  console.log(`Deploying from ${account.address} to Base Sepolia...`);
  const hash = await wallet.deployContract({ abi: compiled.abi, bytecode: `0x${compiled.evm.bytecode.object}` as `0x${string}` });
  console.log(`Deployment tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deployment mined without a contract address.");
  console.log(`Registry address: ${receipt.contractAddress}`);
  console.log(`Explorer: https://sepolia.basescan.org/address/${receipt.contractAddress}`);
}

void main();
