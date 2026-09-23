# ClauseGuard — Build Prompt

Paste this directly to your AI coding agent (Claude Code, Cursor, etc.) as the kickoff prompt for the project. It references the other four docs, which should sit alongside it in the repo root (`blueprint.md`, `design.md`, `ui-ux.md`, `plan.md`).

---

## PROMPT START

You are building **ClauseGuard**, a plain-language contract risk analyzer for freelancers and independent contractors, for submission to LexHack 2026 (deadline Sep 27, 5:00pm EDT). This is a real hackathon submission that needs to actually work end-to-end and look distinctive — not a toy demo.

Before writing any code, read these four documents in full, in this order, and hold yourself to them throughout the build:

1. **`blueprint.md`** — product scope, architecture, data model, LLM strategy, on-chain sealing flow. This defines *what* to build and *what not to build*. Do not add features beyond the "in scope" list in §5 without checking with me first.
2. **`design.md`** — visual design system. Follow §0 exactly: install and run the `ui-ux-pro-max` skill (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) to generate a base design system for this product category, then apply the `taste-skill` (https://github.com/Leonxlnx/taste-skill, install name `design-taste-frontend`) as an anti-slop pass on top of it, with the dial settings specified there (VARIANCE 5/10, MOTION 3/10, DENSITY 6/10). Do not default to generic AI-purple/blue-gradient SaaS styling — the whole point of this design system is that it should NOT look like a templated AI-wrapper product. Follow the "Redline Desk" concept (paper/ink, real document at the center, risk-colored marginalia) throughout.
3. **`ui-ux.md`** — full screen-by-screen UX spec, component inventory, and accessibility requirements. Build exactly these screens and components, in the structure described. Pay particular attention to the split-pane Report View (§2.4) — it's the core of the product.
4. **`plan.md`** — the day-by-day build sequence. Follow this order: scaffold → LLM analysis pipeline → report UI → on-chain sealing + responsiveness → polish/video/submission. Don't jump ahead to polish before the core flow works end to end.

### Execution instructions

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, deployed to Vercel. LLM calls via Anthropic API or OpenRouter (use a free tier where possible — this project has a $0 budget). On-chain sealing via `viem`/`wagmi` or `ethers.js` targeting Sepolia or Base Sepolia testnet.
- **Work incrementally and check in with me** at the end of each day's checkpoint as defined in `plan.md` — don't build silently for days at a time. Show me working slices as they're ready (e.g. "upload + raw text extraction works" before moving to the LLM pipeline).
- **Deploy early and often.** Get a placeholder live on Vercel on Day 1 and keep every day's work deployed, so there's never a point where the project only works locally.
- **Structured LLM output:** the `/api/analyze` route must return data validated against the `ContractReport` / `ClauseFinding` types in `blueprint.md` §7 — use schema validation (e.g. zod) so malformed LLM output fails loudly in development rather than silently breaking the UI.
- **Accessibility is not optional.** Run through the checklists in `design.md` §6 and `ui-ux.md` §4 before considering any screen "done" — risk badges must never rely on color alone, focus states must be visible, text must reflow without clipping, `prefers-reduced-motion` must be respected.
- **Keep the on-chain sealing flow real, not mocked.** It should actually write to a live testnet and the "Verify" button should actually recompute hashes client-side and check them against on-chain data — this is the single biggest technical differentiator versus every other "AI reads your contract" submission at this hackathon, so it needs to genuinely work, not just look like it works.
- **Be honest in the product itself.** Include a clear "not legal advice" disclaimer in the UI (landing page trust strip and report summary) — don't overclaim what an LLM-based tool can actually guarantee.
- **When in doubt about scope, cut rather than add.** A smaller, fully-working, well-designed product beats a broader half-finished one — this is explicitly called out as the biggest hackathon failure mode in `plan.md`.

### What "done" looks like
A judge should be able to: land on the homepage → understand in 5 seconds who this is for and what it does → paste or upload a sample freelance contract → see a clearly designed, clause-by-clause risk report within ~20 seconds → open a flagged clause and read a plain-English explanation with a redline suggestion → click Seal Review → watch it write to a public testnet and get a verifiable certificate → optionally check Review History and see it persisted. All of this should work on a fresh deploy, in a fresh browser, with no setup on the judge's end.

Start with Day 1 of `plan.md`. Confirm you've read all four reference documents before writing the first line of code, and tell me your understanding of the MVP scope back to me in 3-4 sentences before starting, so we can catch any misalignment early.

## PROMPT END
