/**
 * Core data model. Mirrors blueprint.md section 7.
 *
 * Deviation (approved): `whyItMatters` is an optional extra on ClauseFinding so the
 * Clause Detail drawer can render the "Why this matters" line from ui-ux.md section 2.5.
 *
 * Runtime validation for these shapes lives in `src/lib/schema.ts`; the schemas there are
 * type-checked against these interfaces so the two can never silently drift apart.
 */

export const CATEGORIES = [
  "ip_ownership",
  "payment_terms",
  "termination",
  "liability",
  "non_compete",
  "jurisdiction",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const RISK_LEVELS = ["high", "medium", "low"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface ClauseFinding {
  id: string;
  category: Category;
  /** The exact excerpt from the contract (server snaps this to the verbatim source text). */
  clauseText: string;
  riskLevel: RiskLevel;
  /** Plain-English, 1-3 sentences, addressed to "you". */
  riskExplanation: string;
  /** Fairer alternative language the contractor could propose. */
  suggestedRedline: string;
  /** e.g. "Section 4.2" if detectable. */
  locationHint?: string;
  /** One sentence on the real-world consequence. */
  whyItMatters?: string;
}

export interface SealRecord {
  contractHash: string;
  reportHash: string;
  txHash: string;
  chainId: number;
  timestamp: string;
  explorerUrl: string;
}

export interface ContractReport {
  id: string;
  /** ISO timestamp */
  createdAt: string;
  contractTitle: string;
  /** 0-100, higher = riskier */
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  findings: ClauseFinding[];
  /** 2-3 sentence plain-English TL;DR, always ends with a not-legal-advice note. */
  summary: string;
  sealed?: SealRecord;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  ip_ownership: "IP / Ownership",
  payment_terms: "Payment Terms",
  termination: "Termination",
  liability: "Liability / Indemnification",
  non_compete: "Non-Compete / Exclusivity",
  jurisdiction: "Jurisdiction / Disputes",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};
