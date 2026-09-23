# ClauseGuard

Plain-language contract risk review for freelancers and independent contractors. Paste or upload a contract; ClauseGuard flags the clauses that could hurt you (IP grabs, bad payment terms, one-sided termination, non-competes, liability, jurisdiction traps), explains each in plain English, suggests fairer wording, and seals a verifiable fingerprint of your review on Base Sepolia.

**Not legal advice.** A first line of defense before you sign.

Built for LexHack 2026. Planning docs: [`blueprint.md`](blueprint.md), [`design.md`](design.md), [`ui-ux.md`](ui-ux.md), [`plan.md`](plan.md). Design-system reconciliation: [`design-system/clauseguard/DECISIONS.md`](design-system/clauseguard/DECISIONS.md).

## Status

| Slice | State |
|---|---|
| Scaffold (Next.js 16, TS, Tailwind 4) | done |
| Design system (`ui-ux-pro-max` + `design-taste-frontend`) | generated, reconciled, tokens in `globals.css` |
| Paste / PDF / DOCX / TXT extraction | done, tested with real files |
| `/api/analyze` (LLM, zod-validated, verbatim-anchored) | done |
| Report View (split pane, drawer, meter) | done |
| Seal + Verify on Base Sepolia, History | done |

## Run locally

```bash
npm install
cp .env.example .env.local   # add the provider and sealing variables you use
npm run dev
```

Required analysis configuration is documented in [`.env.example`](.env.example). The final free chain starts with Groq (`GROQ_API_KEY`), then races free OpenRouter models (`OPENROUTER_API_KEY`) before using the Liquid fallback. `LLM_PROVIDER=fixture npm run dev` replays recorded model responses for development-only UI work; the UI labels fixture reports clearly.

For live Base Sepolia sealing, also set `RELAYER_PRIVATE_KEY`, `NEXT_PUBLIC_REGISTRY_ADDRESS`, and optionally `BASE_SEPOLIA_RPC_URL`. Deploy the registry with `npm run deploy:registry` using a separately funded throwaway deployer key.

```bash
npm test          # unit tests: extraction, clause anchoring, schema, provider fallback
npm run eval      # live accuracy check against the sample contracts
npm run prewarm   # warm the running server's in-memory cache before a demo
npm run typecheck
npm run lint
```

Free-tier model capacity can occasionally be unavailable or rate-limited. ClauseGuard mitigates this with provider retries and fallback racing, a bounded in-memory response cache keyed by contract text, and a one-click **Try again** action in the Analyze screen.

## How analysis works

1. **Extract** (`src/lib/extract.ts`): `unpdf` for PDF (with line reflow so clauses stay intact), `mammoth` for DOCX, encoding-aware TXT. Scanned, corrupt, empty and legacy `.doc` files get specific errors.
2. **Normalise** (`src/lib/text.ts`): one canonical text form that is displayed, analysed, and later hashed for sealing.
3. **LLM** (`src/lib/llm/`): a structured call through the Groq-first free chain. Groq uses OpenAI-compatible JSON output; the top OpenRouter free models race in parallel, with Liquid as a sequential fallback. Providers are held to the same schema and quote checks.
4. **Validate** (`src/lib/schema.ts`): zod validates the model output. Failures are logged in full, and in development the API response includes the issue list.
5. **Anchor** (`src/lib/analyze.ts`): every quoted clause must be found verbatim in the contract (tolerating whitespace, quote style and elisions) or it is dropped. The highlighted text is always the real source text, not the model's copy.
6. **Score** (`src/lib/scoring.ts`): the overall 0-100 score is computed from the findings, not guessed by the model.

## Sealing

[`contracts/ClauseGuardRegistry.sol`](contracts/ClauseGuardRegistry.sol) stores the contract hash, report hash, timestamp, and sender, and emits `ReviewSealed`. The browser computes SHA-256 fingerprints; `/api/seal` recomputes them before the relayer writes to Base Sepolia. The certificate's Verify action recomputes both hashes and checks the stored on-chain record through `/api/seal/verify`.

See [`.env.example`](.env.example) for all environment variables. No `.env.local` secrets are required in the repository.
