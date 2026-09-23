import { describe, expect, it } from "vitest";
import { locateClause, normalizeContractText } from "@/lib/text";

describe("normalizeContractText", () => {
  it("is idempotent and canonicalises whitespace", () => {
    const raw = "A\r\nB\u00A0\u00A0C  D\u200B\n\n\n\nE  ";
    const once = normalizeContractText(raw);
    expect(once).toBe("A\nB C D\n\nE");
    expect(normalizeContractText(once)).toBe(once);
  });
});

describe("locateClause", () => {
  const src =
    "2.2 Company will pay undisputed invoices within ninety (90) days after Company has received payment.\nIf the end client does not pay Company for any reason, Company has no obligation to pay.";

  it("finds exact quotes", () => {
    const q = "within ninety (90) days after Company has received payment";
    const s = locateClause(src, q)!;
    expect(src.slice(s.start, s.end)).toBe(q);
  });

  it("tolerates whitespace, smart quotes, case and trailing punctuation", () => {
    const s = locateClause(src, "company   will pay undisputed invoices within NINETY (90) days after company has received payment")!;
    expect(src.slice(s.start, s.end)).toMatch(/^Company will pay/);
    const t = locateClause("the “Work Product” is owned by Company.", '"Work Product" is owned by Company')!;
    expect(t).not.toBeNull();
  });

  it("spans across line breaks", () => {
    const s = locateClause(src, "received payment. If the end client does not pay Company")!;
    expect(src.slice(s.start, s.end)).toContain("\nIf the end client");
  });

  it("handles ellipsis elisions", () => {
    const s = locateClause(src, "Company will pay undisputed invoices ... Company has no obligation to pay")!;
    expect(src.slice(s.start, s.end).startsWith("Company will pay")).toBe(true);
    expect(src.slice(s.start, s.end).endsWith("no obligation to pay")).toBe(true);
  });

  it("returns null for invented text", () => {
    expect(locateClause(src, "Company will pay a late fee of 5% per week on overdue invoices")).toBeNull();
  });
});
