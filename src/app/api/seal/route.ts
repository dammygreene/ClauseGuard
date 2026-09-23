import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ContractReportSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

const ABI = parseAbi([
  "function registerReview(bytes32 contractHash, bytes32 reportHash)",
  "function getReview(bytes32 contractHash, bytes32 reportHash) view returns (bytes32 contractHash, bytes32 reportHash, uint256 timestamp, address sender)",
]);

function config() {
  const address = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS?.trim();
  const privateKey = process.env.RELAYER_PRIVATE_KEY?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Sealing is not configured: set NEXT_PUBLIC_REGISTRY_ADDRESS.");
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Sealing is not configured: set RELAYER_PRIVATE_KEY.");
  return { address: address as `0x${string}`, privateKey: privateKey as `0x${string}` };
}

function sha256Hex(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function timestampIso(seconds: bigint): string {
  if (seconds <= BigInt(0)) throw new Error("Seal record has no on-chain timestamp.");
  return new Date(Number(seconds) * 1000).toISOString();
}

function validHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { contractText?: unknown; reportJson?: unknown; contractHash?: unknown; reportHash?: unknown };
    if (typeof body.contractText !== "string" || typeof body.reportJson !== "string" || !validHash(body.contractHash) || !validHash(body.reportHash)) {
      return NextResponse.json({ error: "Contract text, report JSON, and both hashes are required." }, { status: 400 });
    }
    const report = ContractReportSchema.parse(JSON.parse(body.reportJson));
    const contractHash = sha256Hex(body.contractText);
    const reportHash = sha256Hex(JSON.stringify(report));
    if (contractHash.toLowerCase() !== body.contractHash.toLowerCase() || reportHash.toLowerCase() !== body.reportHash.toLowerCase()) {
      return NextResponse.json({ error: "Review hashes did not match the submitted content." }, { status: 400 });
    }

    const { address, privateKey } = config();
    const account = privateKeyToAccount(privateKey);
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
    const transport = http(rpcUrl);
    const wallet = createWalletClient({ account, chain: baseSepolia, transport });
    const publicClient = createPublicClient({ chain: baseSepolia, transport });
    const txHash = await wallet.writeContract({ address, abi: ABI, functionName: "registerReview", args: [contractHash, reportHash] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const stored = await publicClient.readContract({ address, abi: ABI, functionName: "getReview", args: [contractHash, reportHash] });
    const timestamp = timestampIso(stored[2]);
    return NextResponse.json({
      seal: { contractHash, reportHash, txHash, chainId: baseSepolia.id, timestamp, explorerUrl: `https://sepolia.basescan.org/tx/${txHash}` },
      receiptStatus: receipt.status,
    });
  } catch (error) {
    console.error("[seal]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to seal this review." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractHash = url.searchParams.get("contractHash");
    const reportHash = url.searchParams.get("reportHash");
    if (!validHash(contractHash) || !validHash(reportHash)) return NextResponse.json({ matches: false }, { status: 400 });
    const { address } = config();
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
    const stored = await createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }).readContract({ address, abi: ABI, functionName: "getReview", args: [contractHash, reportHash] });
    return NextResponse.json({ matches: stored[0].toLowerCase() === contractHash.toLowerCase() && stored[1].toLowerCase() === reportHash.toLowerCase() && stored[2] > BigInt(0) });
  } catch (error) {
    console.error("[seal/verify]", error);
    return NextResponse.json({ matches: false }, { status: 500 });
  }
}
