/**
 * Text utilities shared by client and server.
 *
 * `normalizeContractText` defines the canonical form of a contract. The exact output of
 * this function is what gets displayed, sent to the LLM, stored in history, and SHA-256
 * hashed when a review is sealed. It must be deterministic and idempotent.
 */

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g; // zero-width chars + soft hyphen
const ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\f\v]/g;

export function normalizeContractText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(ZERO_WIDTH, "")
    .replace(ODD_SPACES, " ")
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

/* -------------------------------------------------------------------------- */
/*  Clause location                                                            */
/* -------------------------------------------------------------------------- */

export interface Span {
  start: number;
  end: number;
}

/**
 * Canonicalises text for fuzzy matching while keeping a map back to original offsets.
 * Lowercases, unifies quotes and dashes, and collapses all whitespace runs to one space.
 */
function canonicalize(text: string): { canon: string; map: number[] } {
  let canon = "";
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace || canon.length === 0) continue;
      ch = " ";
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
      ch = ch.toLowerCase();
      if (/[\u2018\u2019\u201A\u201B\u2032`]/.test(ch)) ch = "'";
      else if (/[\u201C\u201D\u201E\u201F\u2033]/.test(ch)) ch = '"';
      else if (/[\u2010-\u2015\u2212]/.test(ch)) ch = "-";
    }
    canon += ch;
    map.push(i);
  }
  return { canon, map };
}

function canonOnly(text: string): string {
  return canonicalize(text).canon.trim();
}

function spanFromCanon(map: number[], cStart: number, cEnd: number): Span {
  // cEnd is exclusive in canonical space
  return { start: map[cStart], end: map[cEnd - 1] + 1 };
}

const ELLIPSIS = /\s*(?:\u2026|\.{3,}|\[\s*\.{3}\s*\])\s*/;

/**
 * Finds `quote` inside `source`, tolerating whitespace, quote-style, dash and case
 * differences, and "..." elisions. Returns the matching span in `source`, or null if the
 * quote cannot be located (i.e. the model paraphrased or invented it).
 */
export function locateClause(source: string, quote: string, fromIndex = 0): Span | null {
  const q = quote.trim().replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, "").trim();
  if (q.length < 8) return null;

  // 1. Exact
  const exact = source.indexOf(q, fromIndex);
  if (exact !== -1) return { start: exact, end: exact + q.length };

  const { canon, map } = canonicalize(source);
  const cFrom = map.findIndex((orig) => orig >= fromIndex);
  const searchFrom = cFrom === -1 ? canon.length : cFrom;

  // 2. Canonical match
  const cq = canonOnly(q);
  const ci = canon.indexOf(cq, searchFrom);
  if (ci !== -1) return spanFromCanon(map, ci, ci + cq.length);

  // Also try without trailing punctuation (models often drop or add a final period)
  const cqTrim = cq.replace(/[.;,:]+$/, "");
  if (cqTrim.length >= 8 && cqTrim !== cq) {
    const ct = canon.indexOf(cqTrim, searchFrom);
    if (ct !== -1) return spanFromCanon(map, ct, ct + cqTrim.length);
  }

  // 3. Elided quote: "first part ... last part"
  const parts = q.split(ELLIPSIS).map(canonOnly).filter((p) => p.length >= 8);
  if (parts.length >= 2) {
    let cursor = searchFrom;
    let first = -1;
    let lastEnd = -1;
    for (const part of parts) {
      const at = canon.indexOf(part, cursor);
      if (at === -1) {
        first = -1;
        break;
      }
      if (first === -1) first = at;
      lastEnd = at + part.length;
      cursor = lastEnd;
    }
    if (first !== -1 && lastEnd - first <= cq.length * 3 + 400) {
      return spanFromCanon(map, first, lastEnd);
    }
  }

  // 4. Anchors: the model got the start and end right but drifted in the middle
  const ANCHOR = 40;
  if (cq.length >= ANCHOR * 2 + 10) {
    const head = cq.slice(0, ANCHOR);
    const tail = cq.slice(-ANCHOR);
    const h = canon.indexOf(head, searchFrom);
    if (h !== -1) {
      const t = canon.indexOf(tail, h + ANCHOR);
      if (t !== -1) {
        const end = t + ANCHOR;
        const len = end - h;
        if (len <= cq.length * 1.5 + 80 && len >= cq.length * 0.6) {
          return spanFromCanon(map, h, end);
        }
      }
    }
  }

  return null;
}

/** Intersection-over-union of two spans, used to drop near-duplicate findings. */
export function spanOverlapRatio(a: Span, b: Span): number {
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union === 0 ? 0 : inter / union;
}
