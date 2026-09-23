import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  ContractReportSchema,
  LlmOutputSchema,
  formatZodIssues,
  type LlmFinding,
  type LlmOutput,
} from "@/lib/schema";
import { computeOverallRisk, RISK_ORDER } from "@/lib/scoring";
import { locateClause, spanOverlapRatio, type Span } from "@/lib/text";
import type { ClauseFinding, ContractReport } from "@/types/report";
import type { Provider } from "@/lib/llm/providers";
import { PROMPT_VERSION } from "@/lib/llm/prompt";

export const DISCLAIMER =
  "This is an automated first-pass review, not legal advice. For anything high-stakes, have a lawyer look at it.";

export interface AnalyzeMeta {
  provider: string;
  model: string;
  promptVersion: string;
  /** Findings the model returned whose quote could not be found in the contract. */
  droppedUnverifiable: number;
  /** Findings dropped as near-duplicates of another finding. */
  droppedDuplicates: number;
  attempts: { provider: string; model: string; error?: string }[];
  cached: boolean;
}

export interface AnalyzeResult {
  report: ContractReport;
  meta: AnalyzeMeta;
}

export class AnalyzeError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly status: number,
    public readonly detail?: unknown,
  ) {
    super(userMessage);
    this.name = "AnalyzeError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Post-processing: turn validated model output into a trustworthy report     */
/* -------------------------------------------------------------------------- */

interface Located {
  f: LlmFinding;
  span: Span;
}

export function buildReport(
  llm: LlmOutput,
  contractText: string,
  opts: { title?: string; now?: Date; id?: string } = {},
): { report: ContractReport; droppedUnverifiable: number; droppedDuplicates: number } {
  // 1. Anchor every finding to verbatim source text. Anything we can't find is dropped:
  //    the product promise is that every highlighted clause really is in your contract.
  const located: Located[] = [];
  let droppedUnverifiable = 0;
  for (const f of llm.findings) {
    const span = locateClause(contractText, f.clauseText);
    if (span) located.push({ f, span });
    else droppedUnverifiable++;
  }

  // 2. Drop near-duplicates (same clause flagged twice), keeping the higher risk one.
  located.sort((a, b) => RISK_ORDER[a.f.riskLevel] - RISK_ORDER[b.f.riskLevel]);
  const kept: Located[] = [];
  let droppedDuplicates = 0;
  for (const cand of located) {
    if (kept.some((k) => spanOverlapRatio(k.span, cand.span) >= 0.6)) droppedDuplicates++;
    else kept.push(cand);
  }

  // 3. Document order, stable ids, verbatim clause text.
  kept.sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  const findings: ClauseFinding[] = kept.map(({ f, span }, i) => {
    const finding: ClauseFinding = {
      id: `f${i + 1}`,
      category: f.category,
      clauseText: contractText.slice(span.start, span.end),
      riskLevel: f.riskLevel,
      riskExplanation: f.riskExplanation.trim(),
      suggestedRedline: f.suggestedRedline.trim(),
    };
    if (f.locationHint.trim()) finding.locationHint = f.locationHint.trim();
    if (f.whyItMatters.trim()) finding.whyItMatters = f.whyItMatters.trim();
    return finding;
  });

  const { score, level } = computeOverallRisk(findings);
  const baseSummary = llm.summary.trim().replace(/\s+/g, " ");
  const summary = /not legal advice/i.test(baseSummary) ? baseSummary : `${baseSummary} ${DISCLAIMER}`;

  const report: ContractReport = {
    id: opts.id ?? randomUUID(),
    createdAt: (opts.now ?? new Date()).toISOString(),
    contractTitle: (opts.title?.trim() || llm.contractTitle.trim() || "Untitled contract").slice(0, 160),
    overallRiskScore: score,
    overallRiskLevel: level,
    findings,
    summary,
  };

  // Final gate: the object we hand to the UI must satisfy the public schema.
  const checked = ContractReportSchema.safeParse(report);
  if (!checked.success) {
    throw new AnalyzeError("We couldn't assemble a valid report.", 500, formatZodIssues(checked.error));
  }
  return { report: checked.data, droppedUnverifiable, droppedDuplicates };
}

/* -------------------------------------------------------------------------- */
/*  Provider chain with validation-aware fallback                              */
/* -------------------------------------------------------------------------- */

const CACHE_MAX = 64;
const PARALLEL_PROVIDER_COUNT = 3;
export const ANALYZE_TIMEOUT_MS = 65_000;
const cache = new Map<string, { llm: LlmOutput; provider: string; model: string }>();

function cacheKey(text: string, context?: string): string {
  return createHash("sha256")
    .update(PROMPT_VERSION)
    .update("\u0000")
    .update(context ?? "")
    .update("\u0000")
    .update(text)
    .digest("hex");
}

interface ProviderSuccess {
  provider: Provider;
  llm: LlmOutput;
  built: ReturnType<typeof buildReport>;
}

interface ProviderAttemptFailure {
  provider: string;
  model: string;
  error: string;
  nonContractSummary?: string;
}

type ProviderAttempt = ProviderSuccess | ProviderAttemptFailure;

function isProviderSuccess(attempt: ProviderAttempt): attempt is ProviderSuccess {
  return "llm" in attempt;
}

function throwIfNonContract(attempt: ProviderAttemptFailure): void {
  if (attempt.nonContractSummary) {
    throw new AnalyzeError(
      "This doesn't look like a contract. ClauseGuard reviews agreements such as freelance, contractor, or services contracts.",
      422,
      attempt.nonContractSummary,
    );
  }
}

async function evaluateProvider(
  provider: Provider,
  contractText: string,
  context: string | undefined,
  signal: AbortSignal,
): Promise<ProviderAttempt> {
  let raw: unknown;
  try {
    ({ raw } = await provider.run(contractText, context, signal));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[analyze] ${provider.name}/${provider.model} failed: ${error}`);
    return { provider: provider.name, model: provider.model, error };
  }

  const parsed = LlmOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error);
    console.error(
      `[analyze] ${provider.name}/${provider.model} returned output that failed schema validation:\n  ${issues.join("\n  ")}`,
    );
    return {
      provider: provider.name,
      model: provider.model,
      error: `Schema validation failed: ${issues.slice(0, 5).join("; ")}`,
    };
  }

  const llm = parsed.data;
  if (!llm.isContract) {
    return {
      provider: provider.name,
      model: provider.model,
      error: "The model did not identify the source as a contract.",
      nonContractSummary: llm.summary,
    };
  }

  const built = buildReport(llm, contractText);
  if (built.report.findings.length === 0 && llm.findings.length > 0) {
    const error = `All ${llm.findings.length} quoted clauses were not found verbatim in the contract.`;
    console.error(`[analyze] ${provider.name}/${provider.model}: ${error}`);
    return { provider: provider.name, model: provider.model, error };
  }

  return { provider, llm, built };
}

function storeSuccess(key: string, success: ProviderSuccess): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { llm: success.llm, provider: success.provider.name, model: success.provider.model });
}

async function raceOpenRouterProviders(
  providers: Provider[],
  contractText: string,
  context: string | undefined,
  signal: AbortSignal,
): Promise<{ winner?: ProviderSuccess; attempts: ProviderAttemptFailure[] }> {
  const controllers = providers.map(() => new AbortController());
  const attempts: ProviderAttemptFailure[] = [];
  let winner: ProviderSuccess | undefined;
  let remaining = providers.length;

  const result = await new Promise<ProviderSuccess | undefined>((resolve) => {
    for (const [index, provider] of providers.entries()) {
      const providerSignal = AbortSignal.any([signal, controllers[index].signal]);
      void evaluateProvider(provider, contractText, context, providerSignal).then((attempt) => {
        if (winner) return;
        if (isProviderSuccess(attempt)) {
          winner = attempt;
          resolve(attempt);
          return;
        }
        attempts.push(attempt);
        remaining--;
        if (remaining === 0) resolve(undefined);
      });
    }
  });

  for (const [index] of providers.entries()) {
    if (!result || providers[index] !== result.provider) controllers[index].abort();
  }
  return { winner: result, attempts };
}

export async function analyzeContract(
  contractText: string,
  opts: { context?: string; title?: string; providers: Provider[]; signal?: AbortSignal },
): Promise<AnalyzeResult> {
  if (opts.providers.length === 0) {
    throw new AnalyzeError(
      "Analysis is not configured on this deployment yet (no LLM API key set).",
      503,
      "Set GROQ_API_KEY and/or OPENROUTER_API_KEY. See .env.example.",
    );
  }

  const key = cacheKey(contractText, opts.context);
  const hit = cache.get(key);
  if (hit) {
    const built = buildReport(hit.llm, contractText, { title: opts.title });
    return {
      report: built.report,
      meta: {
        provider: hit.provider,
        model: hit.model,
        promptVersion: PROMPT_VERSION,
        droppedUnverifiable: built.droppedUnverifiable,
        droppedDuplicates: built.droppedDuplicates,
        attempts: [],
        cached: true,
      },
    };
  }

  const signal = opts.signal
    ? AbortSignal.any([opts.signal, AbortSignal.timeout(ANALYZE_TIMEOUT_MS)])
    : AbortSignal.timeout(ANALYZE_TIMEOUT_MS);

  const attempts: AnalyzeMeta["attempts"] = [];
  let candidateProviders = opts.providers;
  if (candidateProviders[0]?.name === "groq") {
    const groqAttempt = await evaluateProvider(candidateProviders[0], contractText, opts.context, signal);
    if (isProviderSuccess(groqAttempt)) {
      storeSuccess(key, groqAttempt);
      return {
        report: buildReport(groqAttempt.llm, contractText, { title: opts.title }).report,
        meta: {
          provider: groqAttempt.provider.name,
          model: groqAttempt.provider.model,
          promptVersion: PROMPT_VERSION,
          droppedUnverifiable: groqAttempt.built.droppedUnverifiable,
          droppedDuplicates: groqAttempt.built.droppedDuplicates,
          attempts,
          cached: false,
        },
      };
    }
    attempts.push(groqAttempt);
    throwIfNonContract(groqAttempt);
    candidateProviders = candidateProviders.slice(1);
  }

  const allOpenRouter = candidateProviders.every((provider) => provider.name === "openrouter");
  const raceProviders = allOpenRouter ? candidateProviders.slice(0, PARALLEL_PROVIDER_COUNT) : [];
  if (raceProviders.length > 1) {
    const raced = await raceOpenRouterProviders(raceProviders, contractText, opts.context, signal);
    attempts.push(...raced.attempts);
    if (raced.winner) {
      storeSuccess(key, raced.winner);
      return {
        report: buildReport(raced.winner.llm, contractText, { title: opts.title }).report,
        meta: {
          provider: raced.winner.provider.name,
          model: raced.winner.provider.model,
          promptVersion: PROMPT_VERSION,
          droppedUnverifiable: raced.winner.built.droppedUnverifiable,
          droppedDuplicates: raced.winner.built.droppedDuplicates,
          attempts,
          cached: false,
        },
      };
    }
    const nonContract = raced.attempts.find((attempt) => attempt.nonContractSummary);
    if (nonContract) throwIfNonContract(nonContract);
  }

  const remainingProviders = allOpenRouter
    ? candidateProviders.slice(PARALLEL_PROVIDER_COUNT)
    : candidateProviders;
  for (const provider of remainingProviders) {
    if (signal.aborted) break;
    const attempt = await evaluateProvider(provider, contractText, opts.context, signal);
    if (isProviderSuccess(attempt)) {
      storeSuccess(key, attempt);
      return {
        report: buildReport(attempt.llm, contractText, { title: opts.title }).report,
        meta: {
          provider: attempt.provider.name,
          model: attempt.provider.model,
          promptVersion: PROMPT_VERSION,
          droppedUnverifiable: attempt.built.droppedUnverifiable,
          droppedDuplicates: attempt.built.droppedDuplicates,
          attempts,
          cached: false,
        },
      };
    }
    attempts.push(attempt);
    throwIfNonContract(attempt);
  }

  throw new AnalyzeError(
    signal.aborted
      ? "The analysis took too long and was stopped. Please try again."
      : "We couldn't analyze this contract right now. The AI service may be busy. Please try again in a minute.",
    signal.aborted ? 504 : 502,
    attempts,
  );
}

/** Test hook */
export function __clearAnalyzeCache() {
  cache.clear();
}
