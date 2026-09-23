# ClauseGuard — UI/UX Specification

## 0. Instructions to the building agent
Apply `ui-ux-pro-max` and `taste-skill` (see design.md section 0 for exact invocation) to every screen described below. This document defines *structure and flow*; design.md defines *visual language*. Both skills' UX guideline sets (119 UX guidelines from `ui-ux-pro-max`, anti-slop layout rules from `taste-skill`) should be applied to resilient text handling, chip/badge overflow, focus states, and interaction timing throughout — don't just apply them to color and type.

## 1. User flow overview

```
Landing → Upload/Paste Contract → Analyzing (loading state) → Report View
   → [select a clause] → Clause Detail (explanation + redline)
   → [Seal Review] → Sealing (loading state) → Certificate View
   → [Review History] → past reports list → re-open any report
```

## 2. Screen-by-screen spec

### 2.1 Landing / Home
**Purpose:** Immediately communicate what ClauseGuard does and for whom, get the user into the upload flow with zero friction.

- Headline should name the actual user directly: something like "Know what you're signing — before you sign it." Subhead names the audience explicitly (freelancers, contractors, gig workers) — don't be vague about who this is for.
- Primary CTA: "Analyze a Contract" — leads straight to upload/paste, no signup wall.
- Secondary: a short "How it works" 3-step visual (Upload → Review flagged clauses → Seal your review) — keep this tight, no scroll-jacking.
- A trust strip: "Not legal advice. A first line of defense before you sign." — set expectations honestly; judges will respect this over overclaiming.
- No account creation required to try it. Optional "connect wallet" only surfaces when the user reaches Seal Review.

### 2.2 Upload / Paste screen
**Purpose:** Get the contract into the system with minimal friction, in whatever form the user has it.

- Two input modes, clearly tabbed: **Paste text** / **Upload file** (PDF, DOCX, TXT).
- File upload: drag-and-drop zone + click-to-browse, immediate filename + page/word count confirmation once parsed.
- Optional field: "What's this contract for?" (freeform, e.g. "Freelance dev contract via agency") — used to give the LLM context, improves classification accuracy, not required.
- Primary action: "Analyze Contract" — disabled until valid input exists.
- Inline validation: if parsing fails (corrupted file, empty paste), show a clear, specific error — never a silent failure.

### 2.3 Analyzing (loading state)
**Purpose:** Bridge the LLM processing time (likely 5-20 seconds) without feeling broken.

- Show real progress stages, not a generic spinner: "Reading contract…" → "Identifying clauses…" → "Scoring risk…" → "Preparing your report…". These should roughly track actual backend steps if the analysis is chunked; if it's a single LLM call, simulate staged messaging tied to elapsed time so it still feels like real progress.
- Keep the uploaded/pasted contract visible (dimmed/blurred) behind the loading state — reinforces that their actual document is being worked on, not a black box.

### 2.4 Report View (the core screen)
**Purpose:** This is where the product proves its value. Must be scannable in seconds, explorable in depth.

**Layout (desktop):** two-pane split.
- **Left pane (60%):** the original contract text, rendered in the serif display font (see design.md), with flagged clauses highlighted inline using risk-colored underline/background per severity. Unflagged text renders normally. Scrollable, sticky header showing overall risk score.
- **Right pane (40%):** 
  - Top: **Overall Risk Summary** — the risk-grade visual (see design.md §4), plain-English 2-3 sentence TL;DR, and a category breakdown (small badges: "3 High · 5 Medium · 2 Low" grouped by category).
  - Below: **Findings list** — every flagged clause as a card: category tag, risk badge, one-line summary. Clicking/tapping a card scrolls the left pane to that clause and opens its detail.

**Layout (mobile/narrow):** collapse to tabs — "Document" / "Findings" — user switches between the two rather than split-pane. Tapping a finding switches to Document tab scrolled to that clause, with a "Back to findings" affordance.

**Top bar actions:** "Seal Review" (primary), "Export report" (secondary, PDF/markdown), "New contract" (tertiary).

### 2.5 Clause Detail (expandable drawer or side panel)
**Purpose:** Give full context on one flagged clause without losing place in the document.

Triggered by clicking a finding card or a highlighted span in the document. Shows:
- Category + risk badge
- The exact clause text (quoted)
- "What this means for you" — plain-English explanation, 2-4 sentences, no legal jargon
- "Suggested redline" — proposed fairer language, in a copyable code-block-style component with a "Copy" button
- Optional: "Why this matters" — one sentence on the real-world consequence (e.g. "This means the client could end the contract with zero notice and you'd have no right to payment for work already completed.")

This should be a drawer/panel that slides in without navigating away from the report — the user should be able to click through several findings in sequence without losing their place.

### 2.6 Seal Review flow
**Purpose:** Convert the report into a verifiable, timestamped proof of review — the differentiator feature.

- Triggered from the "Seal Review" button on the Report View.
- Step 1: Confirmation modal — explain in one short paragraph what sealing does ("We'll create a tamper-proof, timestamped record of this exact contract and your risk report, verifiable on a public blockchain. Nothing about the contract's contents is made public — only a cryptographic fingerprint.") This is an important trust moment — do not be vague here.
- Step 2: Sealing (loading state) — brief, single-stage ("Sealing your review…"), typically a few seconds on testnet.
- Step 3: **Certificate view** — the stamped/embossed visual treatment (design.md §4), showing: contract title, timestamp, both hashes (truncated with expand-to-full), transaction hash linked to the block explorer, and a prominent "Verify" button that recomputes hashes client-side and confirms the on-chain match live in front of the user (this is a great demo-video beat — show it actually verifying, not just displaying static data).
- Actions: "Download certificate" (PNG or PDF), "Copy verification link", "Back to report".

### 2.7 Review History
**Purpose:** Let a returning user (or a judge exploring the demo) see this is a real, persistent tool, not a one-shot toy.

- Simple list/table: contract title, date analyzed, overall risk level (badge), sealed status (yes/no with certificate link if yes).
- Clicking a row reopens that report in the Report View (2.4).
- Accessible from a persistent nav item, not buried.

## 3. Component inventory (build these as reusable components)
- `RiskBadge` (High/Medium/Low, color + icon + text, per design.md accessibility rules)
- `ClauseCard` (finding summary card for the right-pane list)
- `ClauseDetailDrawer` (expandable panel, §2.5)
- `RiskMeter` (overall score visual, §2.4)
- `DocumentViewer` (renders contract text with inline highlight spans, handles scroll-to-clause)
- `SealCertificate` (stamped visual, §2.6)
- `UploadDropzone` (drag-drop + click-to-browse + parse status)
- `StagedLoader` (multi-stage loading state, §2.3)

## 4. Accessibility & resilience requirements (non-negotiable, from both skills' UX guideline sets)
- Every `RiskBadge` must carry a text label, never color alone.
- Full keyboard navigation through findings list and clause drawer (tab order, enter/space to open, escape to close drawer).
- Focus states visible throughout — this is a document-review tool likely to be used by keyboard-heavy technical users.
- Long clause text, long redline suggestions, and long contract titles must reflow without clipping at 375px width and under browser text-zoom up to 200%.
- Category and risk-count badges in the summary strip must wrap gracefully, never overflow or clip, at narrow widths — apply `ui-ux-pro-max`'s chip/badge overflow guidance directly (`compact labels remain whole; unavoidable truncation needs an accessible full-value path`).
- All loading/staged states must respect `prefers-reduced-motion` — provide a non-animated equivalent (plain text status) when set.
- Empty states (no contract yet, no history yet) must be designed, not left blank — short, clear, with a CTA back into the primary flow.

## 5. Demo-video-specific UX notes
Since this product will be judged largely on a 3-minute video, sequence the UX so the strongest moments land in this order during a live walkthrough:
1. Paste/upload a real (realistic, redacted/sample) freelance contract — fast.
2. Report view landing — the split-pane reveal is the "wow" moment, make sure the risk-colored highlights are immediately visible without scrolling.
3. Open 1-2 clause details — show the plain-English explanation and the redline suggestion side by side with legalese.
4. Seal Review → Certificate → live Verify click — this is the technical-depth moment for judges, don't rush it.
