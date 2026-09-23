# ClauseGuard design decisions (reconciliation log)

`MASTER.md` in this folder is the raw output of `ui-ux-pro-max` (run with
`--variance 5 --motion 3 --density 6`). This file records where we **override** it and why,
after applying `design.md` (the "Redline Desk" brief) and the `design-taste-frontend`
anti-slop rules. When these conflict, precedence is: accessibility > design.md > taste-skill > MASTER.md.

**Design read (taste-skill 0.B):** a working document-review tool plus a short landing page, for
freelancers and contractors who have no lawyer, in a paper-and-ink "annotated document" style
(not a "chat with your PDF" look), built on Tailwind utilities, IBM Plex, and Source Serif 4 for contract text.

**Dials:** VARIANCE 5, MOTION 3, DENSITY 6 (per design.md section 0).

## Kept from MASTER.md
- Style "Accessible & Ethical": 3px focus rings, skip link, 44px touch targets, reduced motion, 4.5:1 minimum.
- The anti-patterns: no AI purple/pink gradients, no emoji icons, no layout-shifting hovers, no invisible focus.
- Spacing scale (4/8/16/24/32/48/64) and the pre-delivery checklist.
- Chip/badge rule (ux-guidelines "Compact Label Overflow"): badges never wrap internally, the row wraps instead;
  any truncation has a keyboard/touch-accessible full value.

## Overridden
| MASTER.md | Ours | Why |
|---|---|---|
| Primary `#1E3A8A` / secondary `#1E40AF` (blue) | Accent **ink-navy `#1F2A44`**, used only for interactive elements and the brand mark | design.md section 2 bans "trustworthy fintech blue". Navy reads as ink. It also keeps **red reserved for risk**, which is why rust `#8A4B2E` was rejected: it sits too close to high-risk red. |
| Background `#F8FAFC` (cool slate) | **Paper `#FAF8F3`**, ink `#14161A` | Named in design.md. Taste-skill's warm-paper ban applies to premium-consumer briefs, and allows an override when the brief names the colours and the concept is manuscript/document. Both are true here. |
| Destructive `#DC2626` | Risk scale: high `#8C2119`, medium `#634210`, low `#21513B` text on tinted fills | design.md asks for a desaturated red, ochre and a deep green, AAA on badges. The design.md example hexes fail AAA as text (`#B8863A` on paper is 3.0:1), so each hue is darkened for text and the lighter hue is kept for underlines and fills. All badge pairs are 7.2:1 or higher. |
| EB Garamond + Lato | **IBM Plex Sans** (UI), **Source Serif 4** (contract text + display), **IBM Plex Mono** (hashes, section refs) | design.md prefers a legible grotesk for UI and a serif for the document. Plex has a document/engineering character without being Inter. Source Serif 4 has an optical-size axis, so one family covers both 17px contract text and 56px display. A serif is justified by taste-skill 4.1: the concept is literally a legal manuscript. Fraunces and Instrument Serif are avoided. |
| Cards `radius 12px`, `shadow-md`, hover lift `translateY(-2px)` | **2px radius everywhere; pills only for risk badges.** Hairline rules instead of shadows. No hover lifts | Taste-skill 4.4: pick one radius system and document it. The paper metaphor means sharp sheets, rules and margins. The only shadow is the document "sheet" (tinted, not black). |
| Scroll-reveal GSAP motion | No scroll animation. Motion only for: clause flag reveal, risk meter fill, drawer expand (150-250ms, ease-out) | design.md section 5, MOTION 3/10. No GSAP dependency. |
| Section pattern "Trust & Authority + Conversion" (logos, certs, contact sales) | Landing: split hero (copy + real document excerpt with marginalia), 3-step how-it-works, trust strip | There are no logos or certifications to show, and faking them would break the honesty requirement. |

## Token contrast (WCAG, computed)
| Pair | Ratio |
|---|---|
| ink `#14161A` / paper `#FAF8F3` | 17.1 |
| muted `#53575E` / paper | 6.8 |
| accent `#1F2A44` / paper | 13.4 |
| high `#8C2119` / tint `#F6E3E0` | 7.2 (AAA) |
| medium `#634210` / tint `#F5EBD7` | 7.7 (AAA) |
| low `#21513B` / tint `#E1EEE6` | 7.6 (AAA) |
| dark: text `#F0EDE5` / `#0D0E11` | 16.5 |
| dark: high `#F4A69D` / `#2A1513` | 8.9 |
| dark: medium `#EBC57F` / `#2A2112` | 9.7 |
| dark: low `#93D1B0` / `#13241B` | 9.3 |

## Icons
Phosphor (`@phosphor-icons/react`) only. It's on the taste-skill allow-list and fits ui-ux-pro-max stack guidance. Risk badges pair icon + text:
high = `WarningOctagon`, medium = `Warning`, low = `CheckCircle`. Shape differs as well as colour.

## Copy rules (taste-skill 9)
No em or en dashes in UI copy. No "Step 1/2/3" labels (verbs instead). At most one eyebrow per three sections.
One label per intent: "Analyze a contract" is the only CTA wording used for starting a review.
