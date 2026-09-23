"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, List, ArrowLeft, Seal } from "@phosphor-icons/react";
import { CATEGORY_LABELS, type ClauseFinding, type ContractReport, type SealRecord } from "@/types/report";
import { RiskBadge } from "@/components/RiskBadge";
import { RiskMeter } from "@/components/RiskMeter";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ClauseDetailDrawer } from "@/components/ClauseDetailDrawer";
import { SealCertificate } from "@/components/SealCertificate";
import { hashReview } from "@/lib/seal";
import { Modal } from "@/components/Modal";

interface ReportMeta {
  provider: string;
  model: string;
  droppedUnverifiable: number;
  droppedDuplicates: number;
  cached: boolean;
}

type Tab = "document" | "findings";

export function ReportView({
  report,
  contractText,
  meta,
  onSealed,
}: {
  report: ContractReport;
  contractText: string;
  meta: ReportMeta;
  onSealed?: (seal: SealRecord) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(report.findings[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("findings");
  const [showJson, setShowJson] = useState(false);
  const [confirmSeal, setConfirmSeal] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [seal, setSeal] = useState<SealRecord | null>(report.sealed ?? null);
  const sealTriggerRef = useRef<HTMLButtonElement>(null);
  const activeFinding = report.findings.find((finding) => finding.id === activeId) ?? null;
  const counts = useMemo(
    () =>
      (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((category) => ({
        category,
        count: report.findings.filter((finding) => finding.category === category).length,
      })).filter((item) => item.count > 0),
    [report.findings],
  );

  function selectFinding(finding: ClauseFinding) {
    setActiveId(finding.id);
    setTab("document");
  }

  async function sealReview() {
    setConfirmSeal(false);
    setSealing(true);
    setSealError(null);
    try {
      const hashes = await hashReview(contractText, report);
      const response = await fetch("/api/seal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText, reportJson: JSON.stringify(report), ...hashes }),
      });
      const data = (await response.json()) as { seal?: SealRecord; error?: string };
      if (!response.ok || !data.seal) throw new Error(data.error ?? "Unable to seal this review.");
      setSeal(data.seal);
      onSealed?.(data.seal);
    } catch (error) {
      setSealError(error instanceof Error ? error.message : "Unable to seal this review.");
    } finally {
      setSealing(false);
    }
  }

  return (
    <section aria-labelledby="report-heading" className="border-t border-ink pt-6">
      {meta.provider === "fixture" && (
        <p className="mb-4 rounded-[2px] bg-medium-tint px-3 py-2 text-sm font-medium text-medium">
          Development fixture: this is a recorded response, not a live analysis.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="report-heading" className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{report.contractTitle}</h2>
            <RiskBadge level={report.overallRiskLevel} />
          </div>
          <p className="mt-3 max-w-[72ch] leading-relaxed text-ink-2">{report.summary}</p>
          <p className="mt-2 font-mono text-xs text-muted">
            {meta.provider}/{meta.model}{meta.cached ? " · cached" : ""} · {report.findings.length} findings
            {meta.droppedUnverifiable ? ` · ${meta.droppedUnverifiable} unverifiable quote(s) dropped` : ""}
            {meta.droppedDuplicates ? ` · ${meta.droppedDuplicates} duplicate(s) dropped` : ""}
          </p>
        </div>
        <div className="w-full max-w-[230px] border-l-2 border-rule pl-4 sm:min-w-[210px]">
          <RiskMeter score={report.overallRiskScore} level={report.overallRiskLevel} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-rule py-4">
        {!seal && <button ref={sealTriggerRef} type="button" onClick={() => setConfirmSeal(true)} disabled={sealing} className="btn btn-primary"><Seal aria-hidden="true" className="h-4 w-4" weight="bold" /> {sealing ? "Sealing your review…" : "Seal review"}</button>}
        {sealing && <span className="text-sm text-muted" aria-live="polite">Writing a timestamped fingerprint to Base Sepolia…</span>}
        {sealError && <p role="alert" className="text-sm font-medium text-high">{sealError}</p>}
      </div>
      {seal && <SealCertificate report={report} contractText={contractText} seal={seal} />}
      {confirmSeal && (
        <Modal titleId="seal-confirm-heading" onClose={() => setConfirmSeal(false)}>
            <h3 id="seal-confirm-heading" className="font-serif text-2xl font-semibold text-ink">Seal this review?</h3>
            <p className="mt-3 leading-relaxed text-ink-2">We will create a tamper-proof, timestamped record of this exact contract and risk report on Base Sepolia. The contents stay private. Only cryptographic fingerprints are written on-chain.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setConfirmSeal(false)} className="btn btn-secondary">Cancel</button>
              <button type="button" onClick={() => void sealReview()} className="btn btn-primary"><Seal aria-hidden="true" className="h-4 w-4" weight="bold" /> Seal review</button>
            </div>
        </Modal>
      )}

      <div className="mt-8 flex border-b border-rule lg:hidden" role="tablist" aria-label="Report view">
        {(["document", "findings"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 text-sm font-semibold capitalize ${tab === item ? "border-ink text-ink" : "border-transparent text-muted"}`}>
            {item === "document" ? <FileText aria-hidden="true" className="h-4 w-4" /> : <List aria-hidden="true" className="h-4 w-4" />}
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className={tab === "document" ? "block" : "hidden lg:block"}>
          <DocumentViewer contractText={contractText} findings={report.findings} activeId={activeId} onSelect={setActiveId} />
          <div className="mt-6 lg:hidden">
            <ClauseDetailDrawer key={`mobile-${activeFinding?.id ?? "empty"}`} finding={activeFinding} onClose={() => setActiveId(null)} />
          </div>
        </div>

        <div className={tab === "findings" ? "block" : "hidden lg:block"}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Flagged clauses</h3>
              <p className="mt-1 text-sm text-muted">Select a finding to see the exact language and a fairer alternative.</p>
            </div>
            <span className="font-mono text-xs text-muted">{report.findings.length} total</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {counts.map(({ category, count }) => <span key={category} className="border border-rule px-2 py-1 text-xs text-muted">{count} {CATEGORY_LABELS[category]}</span>)}
          </div>
          <ol className="divide-y divide-rule border-y border-rule">
            {report.findings.map((finding) => (
              <li key={finding.id}>
                <button type="button" onClick={() => selectFinding(finding)} aria-current={activeId === finding.id ? "true" : undefined} className={`block w-full px-3 py-4 text-left transition-colors duration-150 hover:bg-paper-2 ${activeId === finding.id ? "border-l-2 border-accent bg-accent-soft" : "border-l-2 border-transparent"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={finding.riskLevel} size="sm" />
                    <span className="text-sm font-semibold text-ink">{CATEGORY_LABELS[finding.category]}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-serif text-base leading-relaxed text-ink-2">{finding.clauseText}</p>
                </button>
              </li>
            ))}
          </ol>
          <ClauseDetailDrawer key={activeFinding?.id ?? "empty"} finding={activeFinding} onClose={() => setActiveId(null)} />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button type="button" onClick={() => setShowJson((value) => !value)} aria-expanded={showJson} className="btn btn-secondary text-sm">
          {showJson ? "Hide" : "Show"} raw report JSON
        </button>
        {tab === "document" && activeFinding && <button type="button" onClick={() => setTab("findings")} className="btn btn-quiet text-sm"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to findings</button>}
      </div>
      {showJson && <pre className="mt-3 max-h-[480px] overflow-auto bg-paper-2 p-4 font-mono text-xs leading-relaxed text-ink-2">{JSON.stringify(report, null, 2)}</pre>}
    </section>
  );
}
