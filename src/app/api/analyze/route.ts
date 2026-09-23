import { NextResponse } from "next/server";
import { AnalyzeRequestSchema, formatZodIssues } from "@/lib/schema";
import { ANALYZE_TIMEOUT_MS, analyzeContract, AnalyzeError } from "@/lib/analyze";
import { getProviderChain } from "@/lib/llm/providers";
import { normalizeContractText } from "@/lib/text";

export const runtime = "nodejs";
export const maxDuration = 60;

const isDev = process.env.NODE_ENV !== "production";

/**
 * POST { contractText, context?, title? } -> { report: ContractReport, contractText, meta }
 *
 * `contractText` in the response is the canonical normalised text the report's clause
 * offsets refer to. The client must store and hash exactly this string.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const contractText = normalizeContractText(parsed.data.contractText);

  try {
    const { report, meta } = await analyzeContract(contractText, {
      context: parsed.data.context,
      title: parsed.data.title,
      providers: getProviderChain(),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(ANALYZE_TIMEOUT_MS)]),
    });
    return NextResponse.json({ report, contractText, meta });
  } catch (err) {
    if (err instanceof AnalyzeError) {
      return NextResponse.json(
        // In development, include the full diagnostic so malformed LLM output fails loudly.
        { error: err.userMessage, ...(isDev && err.detail ? { detail: err.detail } : {}) },
        { status: err.status },
      );
    }
    console.error("[analyze] unexpected error", err);
    return NextResponse.json(
      {
        error: "Something went wrong while analyzing this contract.",
        ...(isDev ? { detail: String((err as Error)?.stack ?? err) } : {}),
      },
      { status: 500 },
    );
  }
}
