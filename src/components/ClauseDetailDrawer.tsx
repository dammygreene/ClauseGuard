"use client";

import { useEffect } from "react";
import { Check, Copy, X } from "@phosphor-icons/react";
import { useState } from "react";
import { CATEGORY_LABELS, type ClauseFinding } from "@/types/report";
import { RiskBadge } from "@/components/RiskBadge";

export function ClauseDetailDrawer({
  finding,
  onClose,
}: {
  finding: ClauseFinding | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!finding) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [finding, onClose]);

  if (!finding) {
    return (
      <div className="flex min-h-[260px] items-center justify-center border-t border-rule py-10 text-center text-sm text-muted lg:min-h-0">
        <p>Select a highlighted clause or finding to inspect it here.</p>
      </div>
    );
  }

  async function copyRedline() {
    if (!finding) return;
    await navigator.clipboard.writeText(finding.suggestedRedline);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <aside className="border-t border-ink pt-5" aria-label="Clause detail" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={finding.riskLevel} size="sm" />
          <span className="text-sm font-semibold text-ink">{CATEGORY_LABELS[finding.category]}</span>
          {finding.locationHint && <span className="font-mono text-xs text-muted">{finding.locationHint}</span>}
        </div>
        <button type="button" onClick={onClose} className="btn btn-quiet min-h-[44px]" aria-label="Close clause detail">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      <blockquote className="mt-5 border-l-2 border-rule-strong pl-4 font-serif text-base leading-relaxed text-ink-2">
        {finding.clauseText}
      </blockquote>

      <div className="mt-6 space-y-5">
        <section>
          <h3 className="text-sm font-semibold text-ink">What this means for you</h3>
          <p className="mt-1.5 leading-relaxed text-ink-2">{finding.riskExplanation}</p>
        </section>
        {finding.whyItMatters && (
          <section>
            <h3 className="text-sm font-semibold text-ink">Why this matters</h3>
            <p className="mt-1.5 leading-relaxed text-ink-2">{finding.whyItMatters}</p>
          </section>
        )}
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Suggested redline</h3>
            <button type="button" onClick={() => void copyRedline()} className="btn btn-secondary min-h-[38px] px-3 text-xs">
              {copied ? <Check aria-hidden="true" className="h-4 w-4" weight="bold" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words border border-rule bg-paper-2 p-4 font-mono text-sm leading-relaxed text-ink-2">
            {finding.suggestedRedline}
          </p>
        </section>
      </div>
    </aside>
  );
}
