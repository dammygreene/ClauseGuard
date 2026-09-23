"use client";

import { useEffect, useMemo, useRef } from "react";
import { locateClause, type Span } from "@/lib/text";
import type { ClauseFinding } from "@/types/report";

const MARKS = {
  high: "bg-high-tint decoration-high-mark",
  medium: "bg-medium-tint decoration-medium-mark",
  low: "bg-low-tint decoration-low-mark",
} as const;

export function DocumentViewer({
  contractText,
  findings,
  activeId,
  onSelect,
}: {
  contractText: string;
  findings: ClauseFinding[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const spans = useMemo(
    () =>
      findings
        .map((finding) => ({ finding, span: locateClause(contractText, finding.clauseText) }))
        .filter((item): item is { finding: ClauseFinding; span: Span } => item.span !== null)
        .sort((a, b) => a.span.start - b.span.start),
    [contractText, findings],
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId]);

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const { finding, span } of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) pieces.push(<span key={`text-${cursor}`}>{contractText.slice(cursor, span.start)}</span>);
    pieces.push(
      <button
        key={finding.id}
        ref={finding.id === activeId ? activeRef : undefined}
        type="button"
        onClick={() => onSelect(finding.id)}
        aria-label={`Open ${finding.category} finding`}
        aria-pressed={finding.id === activeId}
        className={`rounded-[2px] decoration-2 underline underline-offset-4 transition-colors duration-150 ${MARKS[finding.riskLevel]} ${finding.id === activeId ? "ring-2 ring-accent" : "hover:brightness-95"}`}
      >
        {contractText.slice(span.start, span.end)}
      </button>,
    );
    cursor = span.end;
  }
  if (cursor < contractText.length) pieces.push(<span key={`text-${cursor}`}>{contractText.slice(cursor)}</span>);

  return (
    <article className="document-sheet min-h-[520px] bg-sheet p-6 sm:p-8" aria-label="Contract document">
      <div className="mb-6 flex items-center justify-between border-b border-rule pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Source contract</p>
        <p className="font-mono text-xs text-muted">{findings.length} flagged</p>
      </div>
      <div className="doc-text">{pieces.length ? pieces : contractText}</div>
    </article>
  );
}
