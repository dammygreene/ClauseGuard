import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeContractText } from "@/lib/text";

const BASE_URL = (process.env.PREWARM_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CASES = ["agency-subcontract-demo.txt", "content-writing.txt", "design-services.txt"];

async function main() {
  let failed = 0;
  console.log(`Prewarming ${BASE_URL}/api/analyze`);

  for (const file of CASES) {
    const contractText = normalizeContractText(readFileSync(path.join("public/samples", file), "utf8"));
    const started = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText }),
      });
      const data = (await response.json().catch(() => null)) as {
        report?: { overallRiskLevel?: string; overallRiskScore?: number };
        meta?: { provider?: string; model?: string; cached?: boolean };
        error?: string;
      } | null;
      if (!response.ok || !data?.report || !data.meta) {
        failed++;
        console.log(`FAIL ${file}: ${data?.error ?? `HTTP ${response.status}`}`);
        continue;
      }
      console.log(
        `PASS ${file} (${((Date.now() - started) / 1000).toFixed(1)}s via ${data.meta.provider}/${data.meta.model}) ` +
          `grade ${data.report.overallRiskLevel} ${data.report.overallRiskScore}/100${data.meta.cached ? " · cached" : ""}`,
      );
    } catch (error) {
      failed++;
      console.log(`FAIL ${file}: ${(error as Error).message}`);
    }
  }

  if (failed) process.exit(1);
}

void main();
