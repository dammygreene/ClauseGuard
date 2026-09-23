import type { ClauseFinding, RiskLevel } from "@/types/report";

/**
 * Overall risk is computed deterministically from the findings rather than asked of the
 * LLM, so the same findings always produce the same grade and the formula can be
 * explained to users. Points saturate so that a pile of low-risk clauses can never
 * outweigh a few genuinely dangerous ones.
 */
export const RISK_POINTS: Record<RiskLevel, number> = { high: 25, medium: 10, low: 2 };
const SATURATION = 60;

export function computeOverallRisk(findings: Pick<ClauseFinding, "riskLevel">[]): {
  score: number;
  level: RiskLevel;
} {
  const points = findings.reduce((sum, f) => sum + RISK_POINTS[f.riskLevel], 0);
  const score = Math.round(100 * (1 - Math.exp(-points / SATURATION)));
  const highs = findings.filter((f) => f.riskLevel === "high").length;

  let level: RiskLevel = "low";
  if (score >= 67 || highs >= 3) level = "high";
  else if (score >= 34 || highs >= 1) level = "medium";

  return { score, level };
}

export function countByLevel(findings: Pick<ClauseFinding, "riskLevel">[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.riskLevel]++;
  return counts;
}

export const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
