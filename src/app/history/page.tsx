"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Seal } from "@phosphor-icons/react";
import { RiskBadge } from "@/components/RiskBadge";
import { readReviewHistory } from "@/lib/history";

export default function HistoryPage() {
  const [entries, setEntries] = useState<ReturnType<typeof readReviewHistory>>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntries(readReviewHistory()), 0);
    const refresh = () => setEntries(readReviewHistory());
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6 lg:py-12">
      <div className="border-b border-ink pb-5">
        <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Review history</h1>
        <p className="mt-2 max-w-[65ch] leading-relaxed text-muted">Your recent reviews are stored in this browser only.</p>
      </div>

      {entries.length === 0 ? (
        <div className="border-b border-rule py-16 text-center">
          <p className="text-sm text-muted">No reviews yet.</p>
          <Link href="/analyze" className="btn btn-primary mt-5">Analyze a contract <ArrowRight aria-hidden="true" className="h-4 w-4" weight="bold" /></Link>
        </div>
      ) : (
        <ol className="divide-y divide-rule border-b border-rule">
          {entries.map((entry) => (
            <li key={entry.report.id}>
              <div className="flex min-w-0 flex-wrap items-center gap-4 px-2 py-5 transition-colors hover:bg-paper-2 sm:px-3">
                <Link href={`/analyze?review=${encodeURIComponent(entry.report.id)}`} className="min-w-0 flex-1">
                  <h2 className="truncate font-serif text-xl font-semibold text-ink">{entry.report.contractTitle}</h2>
                  <p className="mt-1 text-sm text-muted">{new Date(entry.report.createdAt).toLocaleString()}</p>
                </Link>
                <RiskBadge level={entry.report.overallRiskLevel} size="sm" />
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
                  {entry.sealed ? <><Seal aria-hidden="true" className="h-4 w-4 text-low" weight="fill" /> <a href={entry.sealed.explorerUrl} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">Certificate</a></> : "Not sealed"}
                </span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
