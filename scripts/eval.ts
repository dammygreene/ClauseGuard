/**
 * Live accuracy check for the analysis pipeline against the sample contracts.
 *
 *   GROQ_API_KEY=... OPENROUTER_API_KEY=... LLM_PROVIDER=free npm run eval
 *   OPENROUTER_API_KEY=... LLM_PROVIDER=openrouter npm run eval   # OpenRouter-only diagnostic
 *
 * Reports, per contract: provider used, latency, categories found, dropped (unverifiable) quotes,
 * and overall grade vs expectation. Exits non-zero if an expectation fails.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeContract } from "@/lib/analyze";
import { getProviderChain } from "@/lib/llm/providers";
import { normalizeContractText } from "@/lib/text";
import { CATEGORIES, type RiskLevel } from "@/types/report";

const CASES: { file: string; expectLevel: RiskLevel[]; expectAllCategories?: boolean }[] = [
  { file: "agency-subcontract-demo.txt", expectLevel: ["high"], expectAllCategories: true },
  { file: "content-writing.txt", expectLevel: ["high", "medium"] },
  { file: "design-services.txt", expectLevel: ["low", "medium"] },
];

async function main() {
  const providers = getProviderChain();
  if (!providers.length) throw new Error("No provider configured. Set GROQ_API_KEY and/or OPENROUTER_API_KEY.");
  console.log("Provider chain:", providers.map((p) => `${p.name}/${p.model}`).join(" -> "));
  let failed = 0;
  for (const c of CASES) {
    const text = normalizeContractText(readFileSync(path.join("public/samples", c.file), "utf8"));
    const t0 = Date.now();
    try {
      const { report, meta } = await analyzeContract(text, { providers, signal: AbortSignal.timeout(90_000) });
      const cats = new Set(report.findings.map((f) => f.category));
      const missing = CATEGORIES.filter((k) => !cats.has(k));
      const problems: string[] = [];
      if (!c.expectLevel.includes(report.overallRiskLevel)) problems.push(`grade ${report.overallRiskLevel}, expected ${c.expectLevel.join("/")}`);
      if (c.expectAllCategories && missing.length) problems.push(`missing categories: ${missing.join(", ")}`);
      if (meta.droppedUnverifiable > 2) problems.push(`${meta.droppedUnverifiable} unverifiable quotes`);
      failed += problems.length ? 1 : 0;
      console.log(
        `\n${problems.length ? "FAIL" : "PASS"} ${c.file}  (${((Date.now() - t0) / 1000).toFixed(1)}s via ${meta.provider}/${meta.model})\n` +
          `  grade ${report.overallRiskLevel} ${report.overallRiskScore}/100 · ${report.findings.length} findings · ` +
          `dropped ${meta.droppedUnverifiable} unverifiable, ${meta.droppedDuplicates} dupes\n` +
          `  categories: ${[...cats].join(", ")}\n` +
          (meta.attempts.filter((a) => a.error).map((a) => `  fallback: ${a.provider}/${a.model}: ${a.error}\n`).join("")) +
          problems.map((p) => `  !! ${p}\n`).join(""),
      );
    } catch (err) {
      failed++;
      console.log(`\nFAIL ${c.file}: ${(err as Error).message}`, (err as { detail?: unknown }).detail ?? "");
    }
  }
  process.exit(failed ? 1 : 0);
}
void main();
