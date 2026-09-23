# ClauseGuard — Execution Plan (LexHack 2026, deadline Sep 27, 5:00pm EDT)

Today: Sep 22. Deadline: Sep 27, 5:00pm EDT. That's ~5 days. This plan assumes solo build, evenings/focused blocks, and is intentionally tight — the failure mode to avoid is an ambitious plan that doesn't finish, not an underbuilt one that does.

## Day 1 (Sep 22) — Scaffold + core data flow
- [ ] Init Next.js (App Router) + TypeScript + Tailwind project, push to GitHub (public repo, required for submission)
- [ ] Set up Vercel project, confirm free deploy pipeline works end-to-end with a placeholder page (deploy early, deploy often)
- [ ] Install and run `ui-ux-pro-max` design-system generation for ClauseGuard (see design.md §0), persist output
- [ ] Install `taste-skill`, review its checklist so it's ready to apply once real screens exist
- [ ] Define `ClauseFinding` / `ContractReport` TypeScript types (blueprint.md §7) in `/types`
- [ ] Build file/text input handling: paste textarea + PDF parsing (`pdf-parse`) + DOCX parsing (`mammoth`) — test with 2-3 real sample contracts
- [ ] **End of day checkpoint:** you can upload/paste a contract and see its raw extracted text rendered on screen.

## Day 2 (Sep 23) — LLM analysis pipeline
- [ ] Write the system prompt for clause extraction + risk scoring (blueprint.md §8) — iterate against 3-5 real/sample freelance contracts until categorization is consistently accurate
- [ ] Build `/api/analyze` route: takes contract text → calls LLM → returns validated `ContractReport` JSON (add a schema validation step, e.g. zod, to guard against malformed LLM output)
- [ ] Handle edge cases: very short contracts, contracts with no flaggable clauses, contracts that fail to parse cleanly
- [ ] **End of day checkpoint:** paste a contract → get back a real, structured, reasonably accurate risk report as JSON (UI doesn't need to be pretty yet).

## Day 3 (Sep 24) — Report UI + clause detail
- [ ] Build `DocumentViewer` with inline highlight spans (ui-ux.md §3) — this is the most visually important and most fiddly component, budget real time for it
- [ ] Build `RiskBadge`, `RiskMeter`, `ClauseCard`, findings list (right pane)
- [ ] Build `ClauseDetailDrawer` with explanation + copyable redline
- [ ] Wire up the full desktop split-pane Report View (ui-ux.md §2.4)
- [ ] Apply `taste-skill` pass on the Report View specifically — this is the screen judges will spend the most time looking at, so it needs the most design attention
- [ ] **End of day checkpoint:** full upload → analyze → report flow works and looks intentional, on desktop.

## Day 4 (Sep 25) — On-chain sealing + mobile responsiveness
- [ ] Write and deploy `ClauseGuardRegistry.sol` to a testnet (Sepolia or Base Sepolia) — keep it minimal (blueprint.md §9)
- [ ] Fund a relayer wallet from a testnet faucet
- [ ] Build `/api/seal` route: hash contract + report, call the contract, return tx details
- [ ] Build the Seal Review confirmation modal → sealing loader → `SealCertificate` view with live client-side Verify (ui-ux.md §2.6)
- [ ] Make the app responsive down to 375px — collapse the split-pane to tabs (ui-ux.md §2.4 mobile spec)
- [ ] Build Review History screen (simple list, can use localStorage or a lightweight DB table)
- [ ] Run the full accessibility/resilience checklist (ui-ux.md §4, design.md §6)
- [ ] **End of day checkpoint:** the entire flow — landing → upload → report → seal → certificate → verify → history — works end to end, responsive, no major visual bugs.

## Day 5 (Sep 26 → Sep 27 morning) — Polish, video, submission
- [ ] Full pass on landing page copy — make sure it names the real audience clearly (blueprint.md §3)
- [ ] Prepare 2-3 realistic sample contracts to use in the demo video (redact/anonymize anything sensitive)
- [ ] Record the 2-3 minute demo video following the sequencing in ui-ux.md §5 — lead with working software, not a slide deck
- [ ] Write the Devpost submission text: problem → solution → tech stack → what makes it different (freelancer focus + verifiable proof-of-review) → honest "not legal advice" framing
- [ ] Take clean screenshots for the submission gallery
- [ ] Confirm public GitHub repo is clean, has a README, and the live Vercel URL works from a fresh browser/incognito session
- [ ] Submit on Devpost with buffer time before the 5:00pm EDT deadline — do not submit at the last minute
- [ ] **Final checkpoint:** everything required is submitted — project name, summary, problem/solution, working link, repo link, demo video, tech stack list (per LexHack's "What to Submit" requirements).

## Risk management notes
- If LLM clause-extraction accuracy is inconsistent by end of Day 2, narrow the sample-contract test set to 1-2 well-understood contract types (e.g. standard freelance dev agreement) and tune tightly to those rather than trying to generalize to all contract types — a narrow tool that works reliably beats a broad one that's flaky on camera.
- If on-chain sealing eats too much time on Day 4, the fallback is: keep the feature, but simplify to a single hash + a simpler timestamping approach (e.g. OpenTimestamps-style or a minimal single-function contract call) rather than cutting it — it's the single biggest differentiator versus every other "AI contract reader" submission.
- Do not start any feature not listed in blueprint.md §5 "in scope." If you think of something else, write it down for a post-hackathon "Builders Fellowship" pitch instead — LexHack's fellowship explicitly wants to fund exactly that kind of continuation.
