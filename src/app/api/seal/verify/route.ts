import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

export const runtime = "nodejs";

const ABI = parseAbi([
  "function getReview(bytes32 contractHash, bytes32 reportHash) view returns (bytes32 contractHash, bytes32 reportHash, uint256 timestamp, address sender)",
]);

function validHash(value: string | null): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function registryAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Sealing is not configured: set NEXT_PUBLIC_REGISTRY_ADDRESS.");
  return address as `0x${string}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractHash = url.searchParams.get("contractHash");
    const reportHash = url.searchParams.get("reportHash");
    if (!validHash(contractHash) || !validHash(reportHash)) return NextResponse.json({ matches: false }, { status: 400 });

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
    const stored = await createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }).readContract({
      address: registryAddress(),
      abi: ABI,
      functionName: "getReview",
      args: [contractHash, reportHash],
    });
    const matches = stored[0].toLowerCase() === contractHash.toLowerCase()
      && stored[1].toLowerCase() === reportHash.toLowerCase()
      && stored[2] > BigInt(0);
    return NextResponse.json({
      matches,
      timestamp: matches ? new Date(Number(stored[2]) * 1000).toISOString() : null,
    });
  } catch (error) {
    console.error("[seal/verify]", error);
    return NextResponse.json({ matches: false }, { status: 500 });
  }
}