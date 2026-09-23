import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { llmOutputJsonSchema } from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

/**
 * A provider returns the model's raw structured payload (unvalidated `unknown`).
 * Validation happens in one place, in analyze.ts, so every provider is held to the
 * same schema.
 */
export interface ProviderResult {
  raw: unknown;
  provider: string;
  model: string;
}

export interface Provider {
  name: string;
  model: string;
  run(contractText: string, context: string | undefined, signal: AbortSignal): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const TOOL_NAME = "submit_contract_review";
const ANTHROPIC_MAX_OUTPUT_TOKENS = 8_000;
const OPENROUTER_MAX_OUTPUT_TOKENS = 16_000;
const GROQ_MAX_OUTPUT_TOKENS = 16_000;
const OPENROUTER_MAX_ATTEMPTS = 2;
const OPENROUTER_RETRY_DELAY_MS = 2_500;

/* ----------------------------------- Anthropic ---------------------------------- */

function anthropicProvider(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 55_000 });
  return {
    name: "anthropic",
    model,
    async run(contractText, context, signal) {
      try {
        const msg = await client.messages.create(
          {
            model,
            max_tokens: ANTHROPIC_MAX_OUTPUT_TOKENS,
            temperature: 0,
            system: SYSTEM_PROMPT,
            tools: [
              {
                name: TOOL_NAME,
                description: "Submit the structured clause-by-clause risk review of the contract.",
                input_schema: llmOutputJsonSchema() as Anthropic.Tool.InputSchema,
              },
            ],
            tool_choice: { type: "tool", name: TOOL_NAME, disable_parallel_tool_use: true },
            messages: [{ role: "user", content: buildUserMessage(contractText, context) }],
          },
          { signal },
        );
        if (msg.stop_reason === "max_tokens") {
          throw new ProviderError("Model ran out of output tokens before finishing.", "anthropic", true);
        }
        const block = msg.content.find((b) => b.type === "tool_use");
        if (!block || block.type !== "tool_use") {
          throw new ProviderError("Model did not return a structured review.", "anthropic", true);
        }
        return { raw: block.input, provider: "anthropic", model };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (err instanceof Anthropic.APIError) {
          const retryable = err.status === undefined || err.status === 429 || err.status >= 500;
          throw new ProviderError(`Anthropic API error ${err.status ?? ""}: ${err.message}`, "anthropic", retryable);
        }
        throw new ProviderError(`Anthropic request failed: ${(err as Error).message}`, "anthropic", true);
      }
    },
  };
}

/* ---------------------------------- OpenRouter ---------------------------------- */

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last > first) return JSON.parse(candidate.slice(first, last + 1));
    throw new Error("Response was not valid JSON.");
  }
}

async function waitBeforeRetry(signal: AbortSignal, delayMs: number): Promise<void> {
  if (signal.aborted) throw signal.reason ?? new Error("Request aborted.");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Request aborted."));
      },
      { once: true },
    );
  });
}

function openRouterProvider(apiKey: string, model: string): Provider {
  return {
    name: "openrouter",
    model,
    async run(contractText, context, signal) {
      const schema = llmOutputJsonSchema();
      const request = {
        method: "POST" as const,
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://clauseguard.vercel.app",
          "X-Title": "ClauseGuard",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: OPENROUTER_MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: "system",
              content: `${SYSTEM_PROMPT}\n\nReturn ONLY a JSON object matching this JSON Schema, with no prose and no code fences:\n${JSON.stringify(schema)}`,
            },
            { role: "user", content: buildUserMessage(contractText, context) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "contract_review", strict: true, schema },
          },
        }),
      };
      try {
        for (let attempt = 0; attempt < OPENROUTER_MAX_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch("https://openrouter.ai/api/v1/chat/completions", request);
          } catch (err) {
            if (attempt === 0) {
              await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
              continue;
            }
            throw new ProviderError(`OpenRouter request failed: ${(err as Error).message}`, "openrouter", true);
          }

          const body = (await res.json().catch(() => null)) as {
            choices?: { message?: { content?: string }; finish_reason?: string }[];
            error?: { message?: string };
          } | null;
          const retryableBody = res.status === 429 || !body;
          if (!res.ok || !body) {
            if (retryableBody && attempt === 0) {
              await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
              continue;
            }
            throw new ProviderError(
              `OpenRouter ${model} error ${res.status}: ${body?.error?.message ?? res.statusText}`,
              "openrouter",
              true,
            );
          }

          const choice = body.choices?.[0];
          const content = choice?.message?.content;
          if (!content) {
            if (attempt === 0) {
              await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
              continue;
            }
            throw new ProviderError(`OpenRouter ${model} returned no content.`, "openrouter", true);
          }
          if (choice?.finish_reason === "length") {
            throw new ProviderError(`OpenRouter ${model} ran out of output tokens.`, "openrouter", true);
          }

          try {
            return { raw: extractJson(content), provider: "openrouter", model };
          } catch (err) {
            if (attempt === 0) {
              await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
              continue;
            }
            throw new ProviderError(`OpenRouter ${model}: ${(err as Error).message}`, "openrouter", true);
          }
        }
        throw new ProviderError(`OpenRouter ${model} returned no usable response.`, "openrouter", true);
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(`OpenRouter request failed: ${(err as Error).message}`, "openrouter", true);
      }
    },
  };
}

/* -------------------------------------- Groq ----------------------------------- */

function groqProvider(apiKey: string, model: string): Provider {
  return {
    name: "groq",
    model,
    async run(contractText, context, signal) {
      const schema = llmOutputJsonSchema();
      const request = {
        method: "POST" as const,
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: "system",
              content: `${SYSTEM_PROMPT}\n\nReturn ONLY a JSON object matching this JSON Schema, with no prose or code fences:\n${JSON.stringify(schema)}`,
            },
            { role: "user", content: buildUserMessage(contractText, context) },
          ],
          response_format: { type: "json_object" },
        }),
      };

      for (let attempt = 0; attempt < OPENROUTER_MAX_ATTEMPTS; attempt++) {
        let res: Response;
        try {
          res = await fetch("https://api.groq.com/openai/v1/chat/completions", request);
        } catch (err) {
          if (attempt === 0) {
            await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
            continue;
          }
          throw new ProviderError(`Groq request failed: ${(err as Error).message}`, "groq", true);
        }

        const body = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: string }; finish_reason?: string }[];
          error?: { message?: string };
        } | null;
        if (!res.ok || !body) {
          if (attempt === 0 && (res.status === 429 || !body)) {
            await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
            continue;
          }
          throw new ProviderError(
            `Groq ${model} error ${res.status}: ${body?.error?.message ?? res.statusText}`,
            "groq",
            true,
          );
        }

        const choice = body.choices?.[0];
        const content = choice?.message?.content;
        if (!content) {
          if (attempt === 0) {
            await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
            continue;
          }
          throw new ProviderError(`Groq ${model} returned no content.`, "groq", true);
        }
        if (choice?.finish_reason === "length") {
          throw new ProviderError(`Groq ${model} ran out of output tokens.`, "groq", true);
        }

        try {
          return { raw: extractJson(content), provider: "groq", model };
        } catch (err) {
          if (attempt === 0) {
            await waitBeforeRetry(signal, OPENROUTER_RETRY_DELAY_MS);
            continue;
          }
          throw new ProviderError(`Groq ${model}: ${(err as Error).message}`, "groq", true);
        }
      }
      throw new ProviderError(`Groq ${model} returned no usable response.`, "groq", true);
    },
  };
}

/* ------------------------------ Dev fixture replay ------------------------------ */
/*
 * Development-only: replays a recorded model response so UI work doesn't burn API credits.
 * Refuses to run in production. Responses are tagged provider "fixture" and the UI shows a
 * visible banner, so a fixture report can never be mistaken for a real analysis.
 */
function fixtureProvider(): Provider {
  return {
    name: "fixture",
    model: "recorded-response",
    async run(contractText) {
      const file = contractText.includes("Harbor & Pine")
        ? "design-services.json"
        : contractText.includes("Brightline Media")
          ? "content-writing.json"
          : "agency-subcontract.json";
      const raw = JSON.parse(
        await readFile(path.join(process.cwd(), "src/lib/llm/fixtures", file), "utf8"),
      ) as unknown;
      await new Promise((r) => setTimeout(r, 2500));
      return { raw, provider: "fixture", model: file };
    },
  };
}

/* ------------------------------------ Chain ------------------------------------- */

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3.8-27b:free",
  "nex-agi/nex-n2.5-mini:free",
  "liquid/lfm-2.5-2.6b:free",
];

/**
 * Ordered provider chain. Anthropic first when a key is configured, then each configured
 * OpenRouter model as a fallback. `LLM_PROVIDER=fixture` (dev only) short-circuits to replay.
 */
export function getProviderChain(): Provider[] {
  if (process.env.LLM_PROVIDER === "fixture") {
    if (process.env.NODE_ENV === "production") {
      console.error("[analyze] LLM_PROVIDER=fixture is ignored in production builds.");
      return [];
    }
    return [fixtureProvider()];
  }

  const chain: Provider[] = [];
  const mode = process.env.LLM_PROVIDER;
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (mode !== "openrouter" && mode !== "anthropic" && mode !== "fixture" && groqKey) {
    chain.push(groqProvider(groqKey, process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL));
  }

  if (mode === "groq") return chain;

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (mode === "anthropic" && anthropicKey) {
    chain.push(anthropicProvider(anthropicKey, process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL));
  }
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (mode !== "anthropic" && orKey) {
    const models = (process.env.OPENROUTER_MODELS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const m of models.length ? models : DEFAULT_OPENROUTER_MODELS) {
      chain.push(openRouterProvider(orKey, m));
    }
  }
  return chain;
}
