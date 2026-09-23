import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractFromFile, ExtractError, reflowPdfText } from "@/lib/extract";
import { buildReport } from "@/lib/analyze";
import { LlmOutputSchema } from "@/lib/schema";

const fx = (f: string) => readFileSync(path.join(import.meta.dirname, "fixtures", f));
const fixture = (f: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../src/lib/llm/fixtures", f), "utf8"));

describe("extractFromFile", () => {
  it("reads a real PDF and recovers clause structure", async () => {
    const r = await extractFromFile(new File([fx("agency-subcontract.pdf")], "a.pdf", { type: "application/pdf" }));
    expect(r.kind).toBe("pdf");
    expect(r.pages).toBe(3);
    expect(r.words).toBeGreaterThan(1000);
    expect(r.text).toContain("\n\n2.2 Company will pay undisputed invoices");
    expect(r.text).not.toMatch(/payment\nin full/); // hard wraps rejoined
  });

  it("clause quotes from the model still anchor to PDF-extracted text", async () => {
    const r = await extractFromFile(new File([fx("agency-subcontract.pdf")], "a.pdf", { type: "application/pdf" }));
    const { report, droppedUnverifiable } = buildReport(LlmOutputSchema.parse(fixture("agency-subcontract.json")), r.text);
    expect(droppedUnverifiable).toBe(1); // only the planted fake
    for (const f of report.findings) expect(r.text.includes(f.clauseText)).toBe(true);
  });

  it("reads a DOCX", async () => {
    const r = await extractFromFile(new File([fx("content-writing.docx")], "w.docx"));
    expect(r.kind).toBe("docx");
    expect(r.text).toContain("Publisher is not obligated to publish any article");
    expect(r.text).toContain('("Publisher")\nWriter:'); // soft line breaks preserved
  });

  it("rejects image-only PDFs with a specific message", async () => {
    await expect(extractFromFile(new File([fx("image-only.pdf")], "scan.pdf"))).rejects.toThrow(/scanned image/);
  });

  it("rejects corrupt, empty, legacy and unknown files", async () => {
    await expect(extractFromFile(new File(["%PDF-1.4 junk"], "x.pdf"))).rejects.toThrow(/corrupted/);
    await expect(extractFromFile(new File([], "x.txt"))).rejects.toThrow(/empty/);
    await expect(extractFromFile(new File(["hello"], "x.doc", { type: "application/msword" }))).rejects.toThrow(/\.doc/);
    await expect(extractFromFile(new File([new Uint8Array([1, 2, 3])], "x.bin"))).rejects.toBeInstanceOf(ExtractError);
  });

  it("decodes Windows-1252 text files", async () => {
    const bytes = new Uint8Array([...Buffer.from("The \x93Client\x94 agrees ".repeat(20), "latin1")]);
    const r = await extractFromFile(new File([bytes], "c.txt", { type: "text/plain" }));
    expect(r.text).toContain("\u201CClient\u201D");
  });
});

describe("reflowPdfText", () => {
  it("de-hyphenates and joins wrapped lines", () => {
    const out = reflowPdfText("1. PAYMENT\n1.1 The Client will pay the agree-\nment fee within thirty days of receiving\nan invoice.\n1.2 Late fees apply.");
    expect(out).toBe("1. PAYMENT\n\n1.1 The Client will pay the agreement fee within thirty days of receiving an invoice.\n\n1.2 Late fees apply.");
  });
});
