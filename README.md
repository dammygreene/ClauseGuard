# ClauseGuard

Plain-language contract risk review for freelancers and independent contractors. Paste or upload a contract; ClauseGuard flags the clauses that could hurt you (IP grabs, bad payment terms, one-sided termination, non-competes, liability, jurisdiction traps), explains each in plain English, suggests fairer wording, and seals a verifiable fingerprint of your review on Base Sepolia.

**Not legal advice.** A first line of defense before you sign.

Built for [LexHack 2026](https://lexhack-2026.devpost.com/).

**[Live app](https://clauseguard-hack.vercel.app/)** · **[Demo video](https://youtu.be/Bt8mhW6XdXg)**

---

## Why

Freelancers and contractors sign agency and client contracts constantly and almost never get a lawyer to review them. Standard contract language is written by whichever party has more leverage — the party with less leverage usually finds out what they agreed to only after it's too late. ClauseGuard is a first line of defense: a fast, plain-English read on what a contract actually does to you, plus a tamper-proof record that you reviewed it, without ever exposing the contract's contents.

## Status

| Slice | State |
|---|---|
| Scaffold (Next.js 16, TS, Tailwind 4) | done |
| Design system (`ui-ux-pro-max` + `design-taste-frontend`) | generated, reconciled, tokens in `globals.css` |
| Paste / PDF / DOCX / TXT extraction | done, tested with real files |
| `/api/analyze` (LLM, zod-validated, verbatim-anchored) | done |
| Report View (split pane, drawer, meter) | done |
| Seal + Verify on Base Sepolia, History | done |

## How analysis works

1. **Extract** (`src/lib/extract.ts`) — `unpdf` for PDF (with line reflow so clauses stay intact), `mammoth` for DOCX, encoding-aware TXT. Scanned, corrupt, empty, and legacy `.doc` files get specific error messages.
2. **Normalise** (`src/lib/text.ts`) — one canonical text form that is displayed, analysed, and later hashed for sealing.
3. **Analyze** (`src/lib/llm/`) — a structured call through a free-tier-only provider chain: Groq first (OpenAI-compatible JSON output), then the top free OpenRouter models racing in parallel, with Liquid as a sequential fallback. Every provider is held to the same schema and quote checks.
4. **Validate** (`src/lib/schema.ts`) — zod validates the model's output. Failures are logged in full; in development the API response includes the issue list.
5. **Anchor** (`src/lib/analyze.ts`) — every quoted clause must be found verbatim in the source contract (tolerating whitespace, quote style, and elisions) or it's dropped. Highlighted text in the UI is always the real contract text, never the model's paraphrase of it.
6. **Score** (`src/lib/scoring.ts`) — the overall 0–100 risk score is computed from the findings, not guessed by the model.

## Sealing

[`contracts/ClauseGuardRegistry.sol`](contracts/ClauseGuardRegistry.sol) stores a contract hash, report hash, timestamp, and sender per review, and emits `ReviewSealed`. The browser computes SHA-256 fingerprints of the contract and report; `/api/seal` recomputes them independently before a relayer wallet writes the record to Base Sepolia. The certificate's **Verify** action recomputes both hashes client-side and checks them against the on-chain record via `/api/seal/verify` — live, in front of the user, not just a static display.

## Run locally

```bash
npm install
cp .env.example .env.local   # add the provider and sealing variables you use
npm run dev
```

Analysis configuration is documented in [`.env.example`](.env.example). The default free chain starts with Groq (`GROQ_API_KEY`), then races free OpenRouter models (`OPENROUTER_API_KEY`) before falling back to Liquid. `LLM_PROVIDER=fixture npm run dev` replays recorded model responses for UI-only development — the UI clearly labels fixture-mode reports.

For live Base Sepolia sealing, also set `RELAYER_PRIVATE_KEY`, `NEXT_PUBLIC_REGISTRY_ADDRESS`, and optionally `BASE_SEPOLIA_RPC_URL`. Deploy the registry with `npm run deploy:registry` using a separately funded, throwaway deployer key.

```bash
npm test          # unit tests: extraction, clause anchoring, schema, provider fallback
npm run eval       # live accuracy check against the sample contracts
npm run prewarm    # warm the running server's in-memory cache before a demo
npm run typecheck
npm run lint
```

Free-tier model capacity can occasionally be unavailable or rate-limited. ClauseGuard mitigates this with per-provider retries and parallel fallback racing, a bounded in-memory response cache keyed by contract text, and a one-click **Try again** action in the Analyze screen.

## Tech stack

Next.js 16 · TypeScript · Tailwind CSS 4 · Groq · OpenRouter · Solidity · viem · Base Sepolia · Vercel

## Environment variables

See [`.env.example`](.env.example) for the full list. No secrets are committed to this repository.

---

Not legal advice — ClauseGuard uses AI and can miss things. For high-stakes contracts, talk to a lawyer.
