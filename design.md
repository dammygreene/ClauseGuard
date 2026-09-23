# ClauseGuard — Design System

## 0. Instructions to the building agent
Before writing any UI code, load and apply these two skills, in this order:

1. **`ui-ux-pro-max`** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — use its Design System Generator to produce a base design system for a **"Legal Tech / Compliance Tool"** product type. If that exact category isn't in its 192 rules, use the closest match among **Fintech, Cybersecurity Platform, or B2B SaaS** — ClauseGuard needs to read as *trustworthy, precise, and serious* the same way those categories do. Run:
   ```
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "legal tech contract risk analyzer for freelancers" --design-system -p "ClauseGuard"
   ```
   Persist the output so it's retrievable across the build:
   ```
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "legal tech contract risk analyzer" --design-system --persist -p "ClauseGuard"
   ```
2. **`taste-skill`** (https://github.com/Leonxlnx/taste-skill) — install and apply `design-taste-frontend` (or `high-end-visual-design` / soft-skill if the variance dial is available) on top of the generated design system to eliminate generic "AI app" tells: no default purple/blue gradient, no default rounded-card-with-shadow template, no boilerplate hero-centered-headline-with-two-buttons layout. Set the dials as follows:
   - `DESIGN_VARIANCE`: 5/10 — distinctive but not experimental; this is a trust product, not an art project.
   - `MOTION_INTENSITY`: 3/10 — subtle, restrained. Motion should communicate precision (a clause resolving into a risk badge), never decoration for its own sake.
   - `VISUAL_DENSITY`: 6/10 — this is a working tool that shows real information (clause-by-clause findings); it should feel like a dashboard, not a landing page. Dense but never cluttered.

   Run the redesign-audit / pre-flight checklist from `taste-skill` against every screen before considering it final.

Both skills' outputs should be reconciled: `ui-ux-pro-max` supplies the structural design-system data (palette, type pairing, spacing scale, anti-patterns for this category); `taste-skill` is the final pass that kills anything that reads as templated or "AI slop."

## 1. Design concept: "The Redline Desk"
ClauseGuard should feel like sitting across from a sharp, no-nonsense contracts lawyer who respects your time — not like a chatbot, not like a generic SaaS dashboard. The visual metaphor is **the annotated document**: red/amber/green marginalia on real contract text, the way a good lawyer marks up a PDF. Every screen should keep the actual contract text visible and central — the AI's analysis sits *alongside* the document, never replaces it. This is what differentiates ClauseGuard visually from "yet another chat-with-your-PDF" tool.

## 2. Color direction
Do not default to blue/purple SaaS gradients or generic "trustworthy fintech blue." Instead:

- **Base/neutral palette:** near-black ink (`#14161A`) and warm paper-white (`#FAF8F3` — slightly warm, not clinical white) as the primary background pair. This should feel like paper and ink, not "app."
- **Risk semantic colors** (the functional core of the product — these must be unambiguous and accessible):
  - High risk: a desaturated, serious red — not alarm-red. Think `#B3261E` / `#C4453C` territory. Avoid neon or "error toast" red.
  - Medium risk: a muted amber/ochre — `#B8863A` territory, not bright yellow.
  - Low risk / safe: a deep, quiet green — `#2F6B4F` territory, not mint or lime.
- **One accent color** for interactive elements, links, and the brand mark — should NOT be blue. Consider a deep ink-navy (`#1F2A44`) or a burnt umber/rust (`#8A4B2E`) to keep the "legal document" feel and differentiate from every other crypto/AI product's blue-purple default.
- **Dark mode:** ink background (`#0D0E11`), paper-toned text (`#F0EDE5`), same risk semantics adjusted for contrast (AA minimum, prefer AAA on risk badges since they carry critical meaning).

Run the actual palette selection through `ui-ux-pro-max`'s color engine using the prompt above, then sanity-check it against this direction — override any generated palette that defaults to blue/purple SaaS or AI-gradient territory, per `taste-skill`'s anti-slop rules.

## 3. Typography
- **Body/UI font:** a clean, highly legible grotesk or humanist sans for the app chrome and analysis panels (e.g. Inter, IBM Plex Sans, or whatever `ui-ux-pro-max`'s font-pairing engine recommends for the Legal/Fintech category — prioritize legibility over personality here).
- **Contract text display font:** a serif for rendering the actual uploaded contract text in the document viewer — this is a deliberate visual signal that "this is a real legal document," and it visually separates the source text from the AI's UI chrome. Something like Source Serif 4, Lora, or a comparable Google Fonts serif with good long-form readability.
- **Headline/marketing font (landing/hero only):** can carry more personality — but confirm via `taste-skill`'s pairing logic that it doesn't read as generic "AI startup" (avoid the default Inter/Space Grotesk/gradient-text combo that's become templated itself).

## 4. Key UI patterns
- **Risk badges** are the core repeating UI element — pill-shaped, color-coded (red/amber/green from above), always paired with a text label (never color-only, for accessibility).
- **Split-pane clause view:** left/main pane shows the original contract text with inline highlighted spans (colored underline or background wash matching risk level) on the flagged clauses; right pane or expandable drawer shows the plain-English explanation + suggested redline for whichever clause is selected/hovered.
- **Overall risk meter:** a single, glanceable visual (not a generic donut chart — consider a horizontal gauge or a stamped "risk grade" like a wax-seal/document-stamp motif that reinforces the legal-document concept) at the top of the report.
- **Seal Review certificate:** should visually resemble a real certificate/seal — this is a moment to lean into the paper/ink metaphor hard. A stamped or embossed visual treatment (rendered in CSS, not an image asset) reinforces "this is proof," not just "a transaction succeeded."
- **Icons:** use a single consistent icon set (Lucide or Phosphor, per `ui-ux-pro-max`'s stack guidance) — no emoji as icons, no mixed icon families.

## 5. Motion
Per the MOTION_INTENSITY: 3/10 setting — motion is used only to:
- Transition a clause from "unreviewed" to "flagged" state (a brief, precise reveal — not bouncy).
- Animate the overall risk meter filling on report load.
- Smooth expand/collapse of the redline drawer.

No scroll-triggered parallax, no magnetic buttons, no gratuitous hover transforms. Respect `prefers-reduced-motion` throughout, per both skills' accessibility guidance.

## 6. Pre-delivery checklist (from `ui-ux-pro-max`, apply literally before calling any screen done)
- [ ] No emojis as icons (SVG icon set only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Light mode: text contrast 4.5:1 minimum; risk badges AAA where possible
- [ ] Focus states visible for keyboard navigation throughout (this is a document-review tool — keyboard users matter)
- [ ] `prefers-reduced-motion` respected
- [ ] Risk badges never rely on color alone — always paired with text/icon
- [ ] Responsive at 375px, 768px, 1024px, 1440px — the split-pane view must degrade gracefully to a stacked/tabbed layout on mobile
- [ ] Long clause text and redline suggestions reflow without clipping at any width
- [ ] No default AI-purple/blue gradient anywhere in the final UI
- [ ] Run `taste-skill`'s redesign-audit protocol as a final pass on every screen
