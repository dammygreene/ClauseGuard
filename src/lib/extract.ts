import "server-only";
import { normalizeContractText, countWords } from "@/lib/text";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request body limit

export type FileKind = "pdf" | "docx" | "txt";

export interface Extracted {
  text: string;
  kind: FileKind;
  pages?: number;
  words: number;
  chars: number;
}

export class ExtractError extends Error {
  constructor(public readonly userMessage: string, public readonly status = 422) {
    super(userMessage);
    this.name = "ExtractError";
  }
}

function sniffKind(name: string, mime: string, bytes: Uint8Array): FileKind | null {
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head.startsWith("%PDF")) return "pdf";
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const lower = name.toLowerCase();
  if (isZip && (lower.endsWith(".docx") || mime.includes("wordprocessingml"))) return "docx";
  if (lower.endsWith(".doc") || mime === "application/msword") return null; // legacy binary .doc unsupported
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mime.startsWith("text/")) return "txt";
  if (isZip) return "docx";
  return null;
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (/password/i.test(msg)) {
      throw new ExtractError("This PDF is password-protected. Remove the password and try again.");
    }
    throw new ExtractError("We couldn't read this PDF. It may be corrupted. Try re-exporting it, or paste the text instead.");
  }
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  // Reflow each page's hard-wrapped lines into paragraphs, then join pages.
  const joined = (text as string[]).map((p) => reflowPdfText(p)).join("\n\n");
  return { text: joined, pages: totalPages };
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  try {
    // convertToHtml (not extractRawText) so soft line breaks, list items and table cells survive.
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    return htmlToText(value);
  } catch {
    throw new ExtractError("We couldn't read this Word document. Save it as .docx or PDF and try again, or paste the text instead.");
  }
}

/* -------------------------------------------------------------------------- */
/*  Structure recovery                                                         */
/* -------------------------------------------------------------------------- */

const BLOCK_START =
  /^(?:(?:section|article|clause|exhibit|schedule)\s+[\dIVXA-Z]|\(?[a-z0-9]{1,3}[.)]\s|\d+(?:\.\d+)*\.?\s|[•\-*]\s|[A-Z][A-Z0-9 ,&'/-]{3,}$)/i;

/**
 * PDF text arrives as one line per visual line. Join continuation lines back into
 * paragraphs, but start a new block when a line looks like a heading, a numbered
 * clause, a bullet, or when the previous line was visibly short (end of a paragraph).
 */
export function reflowPdfText(page: string): string {
  const lines = page.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const lengths = lines.filter((l) => l.length > 0).map((l) => l.length).sort((a, b) => a - b);
  const typical = lengths.length ? lengths[Math.floor(lengths.length * 0.8)] : 80;

  const out: string[] = [];
  let cur = "";
  let prevLen = 0;
  for (const line of lines) {
    if (!line) {
      if (cur) out.push(cur);
      cur = "";
      prevLen = 0;
      continue;
    }
    const prevEndedShort = prevLen > 0 && prevLen < typical * 0.7;
    const prevEndsBlock = /[:.;!?"”)]$/.test(cur) && prevEndedShort;
    const isAllCapsPrev = cur.length > 0 && cur === cur.toUpperCase() && /[A-Z]{3}/.test(cur);
    const startsBlock = BLOCK_START.test(line) && (prevEndedShort || /[.:;]$/.test(cur) || isAllCapsPrev);
    if (!cur) cur = line;
    else if (startsBlock || prevEndsBlock || isAllCapsPrev) {
      out.push(cur);
      cur = line;
    } else if (cur.endsWith("-") && /^[a-z]/.test(line)) {
      cur = cur.slice(0, -1) + line; // de-hyphenate "agree-\nment"
    } else {
      cur = `${cur} ${line}`;
    }
    prevLen = line.length;
  }
  if (cur) out.push(cur);
  return out.join("\n\n");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\u2022 ")
    .replace(/<\/(?:td|th)>/gi, "  ")
    .replace(/<\/(?:p|h[1-6]|li|tr|table|ul|ol|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // If the file wasn't UTF-8, fall back to Windows-1252 (common for older .txt exports).
  if (utf8.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function extractFromFile(file: File): Promise<Extracted> {
  if (file.size === 0) throw new ExtractError("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ExtractError("That file is larger than 4 MB. Try a smaller export, or paste the text instead.", 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(file.name, file.type, bytes);
  if (!kind) {
    throw new ExtractError(
      file.name.toLowerCase().endsWith(".doc")
        ? "Old-style .doc files aren't supported. Save it as .docx or PDF and try again."
        : "Unsupported file type. Upload a PDF, DOCX, or TXT file.",
      415,
    );
  }

  let raw: string;
  let pages: number | undefined;
  if (kind === "pdf") ({ text: raw, pages } = await extractPdf(bytes));
  else if (kind === "docx") raw = await extractDocx(bytes);
  else raw = decodeText(bytes);

  const text = normalizeContractText(raw);
  const words = countWords(text);

  if (words < 30) {
    throw new ExtractError(
      kind === "pdf"
        ? "We couldn't find any selectable text in this PDF. It's probably a scanned image. ClauseGuard can't read scans yet, so paste the text instead."
        : "We couldn't find enough text in this file to review.",
    );
  }

  return { text, kind, pages, words, chars: text.length };
}
