import { z } from "zod";
import {
  CATEGORIES,
  RISK_LEVELS,
  type ClauseFinding,
  type ContractReport,
} from "@/types/report";

/* -------------------------------------------------------------------------- */
/*  Final report schemas (what /api/analyze returns and what the UI consumes) */
/* -------------------------------------------------------------------------- */

export const CategorySchema = z.enum(CATEGORIES);
export const RiskLevelSchema = z.enum(RISK_LEVELS);

export const ClauseFindingSchema = z.object({
  id: z.string().min(1),
  category: CategorySchema,
  clauseText: z.string().min(1),
  riskLevel: RiskLevelSchema,
  riskExplanation: z.string().min(1),
  suggestedRedline: z.string().min(1),
  locationHint: z.string().min(1).optional(),
  whyItMatters: z.string().min(1).optional(),
}) satisfies z.ZodType<ClauseFinding>;

export const SealRecordSchema = z.object({
  contractHash: z.string().regex(/^0x[0-9a-f]{64}$/i),
  reportHash: z.string().regex(/^0x[0-9a-f]{64}$/i),
  txHash: z.string().regex(/^0x[0-9a-f]{64}$/i),
  chainId: z.number().int().positive(),
  timestamp: z.string().min(1),
  explorerUrl: z.string().url(),
});

export const ContractReportSchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  contractTitle: z.string().min(1),
  overallRiskScore: z.number().int().min(0).max(100),
  overallRiskLevel: RiskLevelSchema,
  findings: z.array(ClauseFindingSchema),
  summary: z.string().min(1),
  sealed: SealRecordSchema.optional(),
}) satisfies z.ZodType<ContractReport>;

/* -------------------------------------------------------------------------- */
/*  LLM output schema (what we ask the model to produce)                       */
/* -------------------------------------------------------------------------- */
/*
 * The model does NOT produce ids, timestamps or the overall score. Those are assigned
 * server-side so they are deterministic and can't be hallucinated. Optional fields are
 * modelled as required strings (empty string = absent) so the same JSON Schema works with
 * providers that enforce "strict" structured output, where every property must be required.
 */

export const LlmFindingSchema = z.object({
  category: CategorySchema.describe("Which of the six categories this clause belongs to."),
  clauseText: z
    .string()
    .min(1)
    .describe(
      "The clause copied VERBATIM from the contract, character for character. Quote only the sentence(s) that create the risk.",
    ),
  locationHint: z
    .string()
    .describe('Section number or heading if visible, e.g. "Section 4.2". Empty string if none.'),
  riskLevel: RiskLevelSchema,
  riskExplanation: z
    .string()
    .min(1)
    .describe("1-3 plain-English sentences addressed to 'you', the contractor. No legal jargon."),
  whyItMatters: z
    .string()
    .describe("One sentence describing the concrete real-world consequence for you. Empty string if obvious."),
  suggestedRedline: z
    .string()
    .min(1)
    .describe("Replacement clause language you could realistically send back to the client."),
});

export const LlmOutputSchema = z.object({
  isContract: z
    .boolean()
    .describe("False if the text is not a contract or agreement of any kind."),
  contractTitle: z
    .string()
    .describe("Short descriptive title, e.g. 'Northgate Digital subcontractor agreement'."),
  summary: z
    .string()
    .min(1)
    .describe("2-3 sentence plain-English TL;DR of the overall risk for you."),
  findings: z.array(LlmFindingSchema),
});

export type LlmFinding = z.infer<typeof LlmFindingSchema>;
export type LlmOutput = z.infer<typeof LlmOutputSchema>;

/** JSON Schema for the LLM output, for provider-native structured output / tool use. */
export function llmOutputJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(LlmOutputSchema, { target: "draft-7" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/* -------------------------------------------------------------------------- */
/*  Request schemas                                                            */
/* -------------------------------------------------------------------------- */

export const MIN_CONTRACT_CHARS = 200;
export const MAX_CONTRACT_CHARS = 80_000;

export const AnalyzeRequestSchema = z.object({
  contractText: z
    .string()
    .trim()
    .min(MIN_CONTRACT_CHARS, {
      message: `That's too short to be a contract. Paste at least ${MIN_CONTRACT_CHARS} characters.`,
    })
    .max(MAX_CONTRACT_CHARS, {
      message: `That's longer than ClauseGuard can review right now (about 30 pages). Try the main agreement without exhibits.`,
    }),
  context: z.string().trim().max(300).optional(),
  title: z.string().trim().max(160).optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/** Human-readable one-liner for a ZodError, used in logs and dev error payloads. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
