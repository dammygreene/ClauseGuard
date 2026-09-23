import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeContract, AnalyzeError, buildReport, __clearAnalyzeCache } from "@/lib/analyze";
import { ContractReportSchema, LlmOutputSchema, llmOutputJsonSchema } from "@/lib/schema";
import { normalizeContractText } from "@/lib/text";
import { computeOverallRisk } from "@/lib/scoring";
import { ProviderError, type Provider } from "@/lib/llm/providers";

const root = path.resolve(__dirname, "..");
const sample = (f: string) => normalizeContractText(readFileSync(path.join(root, "public/samples", f), "utf8"));
const fixture = (f: string) => JSON.parse(readFileSync(path.join(root, "src/lib/llm/fixtures", f), "utf8"));

const fake = (name: string, fn: () => unknown): Provider => ({
  name,
  model: `${name}-model`,
  async run() {
    return { raw: fn(), provider: name, model: `${name}-model` };
  },
});

beforeEach(() => __clearAnalyzeCache());

describe("fixtures", () => {
  it.each(["agency-subcontract", "design-services", "content-writing"])("%s satisfies the LLM schema", (n) => {
    expect(LlmOutputSchema.safeParse(fixture(`${n}.json`)).success).toBe(true);
  });
});

describe("buildReport", () => {
  it("anchors findings to verbatim text, drops invented quotes, and validates", () => {
    const text = sample("agency-subcontract.txt");
    const llm = LlmOutputSchema.parse(fixture("agency-subcontract.json"));
    const { report, droppedUnverifiable } = buildReport(llm, text);

    expect(droppedUnverifiable).toBe(1); // the planted "5% per week" finding
    expect(report.findings.length).toBe(llm.findings.length - 1);
    for (const f of report.findings) expect(text.includes(f.clauseText)).toBe(true);
    // all six categories represented in the sample
    expect(new Set(report.findings.map((f) => f.category)).size).toBe(6);
    // document order
    const starts = report.findings.map((f) => text.indexOf(f.clauseText));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(report.summary).toMatch(/not legal advice/i);
    expect(report.overallRiskLevel).toBe("high");
    expect(ContractReportSchema.safeParse(report).success).toBe(true);
  });

  it("dedupes overlapping findings keeping the higher risk", () => {
    const text = sample("content-writing.txt");
    const llm = LlmOutputSchema.parse(fixture("content-writing.json"));
    const dup = { ...llm.findings[0], riskLevel: "low" as const };
    const { report, droppedDuplicates } = buildReport({ ...llm, findings: [dup, ...llm.findings] }, text);
    expect(droppedDuplicates).toBe(1);
    expect(report.findings.find((f) => f.clauseText.includes("not obligated to publish"))?.riskLevel).toBe("high");
  });

  it("a fair contract scores low", () => {
    const { report } = buildReport(LlmOutputSchema.parse(fixture("design-services.json")), sample("design-services.txt"));
    expect(report.overallRiskLevel).toBe("low");
  });
});

describe("scoring", () => {
  it("is monotonic and bounded", () => {
    expect(computeOverallRisk([]).score).toBe(0);
    const many = Array.from({ length: 40 }, () => ({ riskLevel: "high" as const }));
    expect(computeOverallRisk(many).score).toBeLessThanOrEqual(100);
    expect(computeOverallRisk([{ riskLevel: "high" }]).level).toBe("medium");
    expect(computeOverallRisk(Array.from({ length: 10 }, () => ({ riskLevel: "low" as const }))).level).toBe("low");
  });
});

describe("analyzeContract provider chain", () => {
  const text = sample("agency-subcontract.txt");

  it("falls back when the first provider returns malformed JSON", async () => {
    const res = await analyzeContract(text, {
      providers: [fake("broken", () => ({ findings: "nope" })), fake("good", () => fixture("agency-subcontract.json"))],
    });
    expect(res.meta.provider).toBe("good");
    expect(res.meta.attempts[0].error).toMatch(/Schema validation failed/);
  });

  it("falls back when the first provider throws", async () => {
    const throwing: Provider = {
      name: "down",
      model: "x",
      async run() {
        throw new ProviderError("503", "down", true);
      },
    };
    const res = await analyzeContract(text, { providers: [throwing, fake("good", () => fixture("agency-subcontract.json"))] });
    expect(res.meta.provider).toBe("good");
  });

  it("falls back when every quote is hallucinated", async () => {
    const bad = fixture("agency-subcontract.json");
    bad.findings = bad.findings.map((f: { clauseText: string }) => ({ ...f, clauseText: "Totally invented clause text that is not present." }));
    const res = await analyzeContract(text, { providers: [fake("liar", () => bad), fake("good", () => fixture("agency-subcontract.json"))] });
    expect(res.meta.provider).toBe("good");
  });

  it("fails loudly with attempt details when all providers fail", async () => {
    await expect(analyzeContract(text, { providers: [fake("a", () => null), fake("b", () => ({}))] })).rejects.toMatchObject({
      status: 502,
      detail: expect.arrayContaining([expect.objectContaining({ error: expect.stringMatching(/Schema validation/) })]),
    });
  });

  it("rejects non-contracts with 422", async () => {
    const err = await analyzeContract(text, {
      providers: [fake("x", () => ({ isContract: false, contractTitle: "", summary: "A recipe.", findings: [] }))],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AnalyzeError);
    expect(err.status).toBe(422);
  });

  it("returns 503 when no provider is configured", async () => {
    await expect(analyzeContract(text, { providers: [] })).rejects.toMatchObject({ status: 503 });
  });

  it("caches identical requests", async () => {
    let calls = 0;
    const p = fake("counted", () => (calls++, fixture("agency-subcontract.json")));
    await analyzeContract(text, { providers: [p] });
    const second = await analyzeContract(text, { providers: [p] });
    expect(calls).toBe(1);
    expect(second.meta.cached).toBe(true);
  });
});

describe("JSON schema for providers", () => {
  it("requires every property (strict structured output compatible)", () => {
    const s = llmOutputJsonSchema() as { required: string[]; properties: Record<string, unknown> };
    expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
    const item = (s.properties.findings as { items: { required: string[]; properties: object } }).items;
    expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
  });
});
