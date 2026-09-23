"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { UploadDropzone, type ParsedFile } from "@/components/UploadDropzone";
import { ReportView } from "@/components/ReportView";
import { countWords, normalizeContractText } from "@/lib/text";
import { readReviewHistory, saveReviewHistory } from "@/lib/history";
import type { ContractReport } from "@/types/report";

const MIN_CHARS = 200;
const MAX_CHARS = 80_000;

const SAMPLES = [
  { file: "agency-subcontract-demo.txt", label: "Agency subcontract (demo)" },
  { file: "design-services.txt", label: "Brand design agreement" },
  { file: "content-writing.txt", label: "Freelance writing agreement" },
];

type Mode = "paste" | "upload";

interface AnalyzeMeta {
  provider: string;
  model: string;
  droppedUnverifiable: number;
  droppedDuplicates: number;
  cached: boolean;
}

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string; detail?: unknown }
  | { status: "done"; report: ContractReport; contractText: string; meta: AnalyzeMeta };

export function AnalyzeWorkbench() {
  const [mode, setMode] = useState<Mode>("paste");
  const [pasted, setPasted] = useState("");
  const [uploaded, setUploaded] = useState<ParsedFile | null>(null);
  const [context, setContext] = useState("");
  const [run, setRun] = useState<Run>({ status: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  const pasteId = useId();
  const contextId = useId();
  const pasteHelpId = useId();

  const rawText = mode === "paste" ? pasted : (uploaded?.text ?? "");
  const text = useMemo(() => normalizeContractText(rawText), [rawText]);
  const words = useMemo(() => countWords(text), [text]);

  const validation: string | null =
    text.length === 0
      ? null
      : text.length < MIN_CHARS
        ? `That's too short to be a contract. Add at least ${MIN_CHARS - text.length} more characters.`
        : text.length > MAX_CHARS
          ? "That's longer than ClauseGuard can review right now (about 30 pages). Try the main agreement without exhibits."
          : null;
  const canAnalyze = text.length >= MIN_CHARS && text.length <= MAX_CHARS && run.status !== "running";

  useEffect(() => {
    if (run.status === "done" || run.status === "error") {
      resultRef.current?.focus();
    }
  }, [run.status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reviewId = new URLSearchParams(window.location.search).get("review");
      if (!reviewId) return;
      const entry = readReviewHistory().find((item) => item.report.id === reviewId);
      if (!entry) return;
      setMode("paste");
      setPasted(entry.contractText);
      setRun({ status: "done", report: { ...entry.report, sealed: entry.sealed }, contractText: entry.contractText, meta: entry.meta });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadSample(file: string) {
    const res = await fetch(`/samples/${file}`);
    setMode("paste");
    setPasted(await res.text());
    setRun({ status: "idle" });
  }

  async function analyze() {
    if (!canAnalyze) return;
    setRun({ status: "running" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText: text, context: context || undefined }),
      });
      const data = await res.json().catch(() => ({ error: "The server returned an unexpected response." }));
      if (!res.ok) {
        setRun({ status: "error", message: data.error ?? "Analysis failed.", detail: data.detail });
        return;
      }
      saveReviewHistory({ report: data.report, contractText: data.contractText, meta: data.meta });
      setRun({ status: "done", report: data.report, contractText: data.contractText, meta: data.meta });
    } catch {
      setRun({ status: "error", message: "Couldn't reach ClauseGuard. Check your connection and try again." });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:py-12">
      <div className="max-w-[65ch]">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.015em] text-ink sm:text-4xl">Analyze a contract</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Paste the text or upload the file you were sent. The text is sent to an AI model for analysis and is not stored by ClauseGuard; your review history stays in this browser.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Input column */}
        <section aria-labelledby="input-heading" className="min-w-0">
          <h2 id="input-heading" className="sr-only">
            Contract input
          </h2>
          <div role="tablist" aria-label="Input method" className="flex gap-0 border-b border-rule">
            {(["paste", "upload"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                id={`tab-${m}`}
                aria-selected={mode === m}
                aria-controls={`panel-${m}`}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    const next = m === "paste" ? "upload" : "paste";
                    setMode(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                className={`-mb-px min-h-[44px] border-b-2 px-4 text-[0.9375rem] font-medium transition-colors duration-150 ${
                  mode === m ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {m === "paste" ? "Paste text" : "Upload file"}
              </button>
            ))}
          </div>

          <div className="pt-5">
            <div id="panel-paste" role="tabpanel" aria-labelledby="tab-paste" hidden={mode !== "paste"}>
              <label htmlFor={pasteId} className="mb-2 block text-sm font-medium text-ink">
                Contract text
              </label>
              <textarea
                id={pasteId}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                aria-describedby={pasteHelpId}
                aria-invalid={mode === "paste" && !!validation}
                rows={14}
                spellCheck={false}
                className="field min-h-[280px] resize-y font-serif text-[0.9375rem] leading-relaxed"
                placeholder="Paste the full agreement here…"
              />
              <div id={pasteHelpId} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">
                  Try a sample:{" "}
                  {SAMPLES.map((s, i) => (
                    <span key={s.file}>
                      <button
                        type="button"
                        onClick={() => void loadSample(s.file)}
                        className="rounded-[2px] font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2"
                      >
                        {s.label}
                      </button>
                      {i < SAMPLES.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </span>
                {text.length > 0 && <span className="tabular-nums text-muted">{words.toLocaleString()} words</span>}
              </div>
            </div>

            <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload" hidden={mode !== "upload"}>
              <UploadDropzone onParsed={setUploaded} onClear={() => setUploaded(null)} />
            </div>

            <div className="mt-6">
              <label htmlFor={contextId} className="mb-2 block text-sm font-medium text-ink">
                What&apos;s this contract for? <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id={contextId}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={300}
                className="field"
                placeholder="e.g. Freelance dev contract via an agency"
              />
              <p className="mt-1.5 text-sm text-muted">Helps the review focus on what matters for your kind of work.</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => void analyze()} disabled={!canAnalyze} className="btn btn-primary">
                {run.status === "running" ? (
                  <>
                    <CircleNotch aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Analyzing…
                  </>
                ) : (
                  <>
                    Analyze contract <ArrowRight aria-hidden="true" className="h-4 w-4" weight="bold" />
                  </>
                )}
              </button>
              <p aria-live="polite" className="text-sm font-medium text-high">
                {validation}
              </p>
            </div>
          </div>
        </section>

        {/* Extracted text preview: Day 1 checkpoint */}
        <section aria-labelledby="preview-heading" className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
            <h2 id="preview-heading" className="text-sm font-semibold text-ink">
              Extracted text
            </h2>
            {text.length > 0 && (
              <span className="text-sm tabular-nums text-muted">
                {text.length.toLocaleString()} characters
              </span>
            )}
          </div>
          <div className="mt-4 max-h-[560px] overflow-auto rounded-[2px] bg-sheet p-6 shadow-sheet sm:p-8" tabIndex={0} aria-label="Extracted contract text">
            {text ? (
              <div className="doc-text">{text}</div>
            ) : (
              <p className="py-16 text-center text-sm text-muted">
                Your contract will appear here exactly as ClauseGuard reads it.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Result: Day 2 checkpoint (functional, not the final Report View) */}
      <div ref={resultRef} tabIndex={-1} className="mt-12 outline-none" aria-live="polite">
        {run.status === "error" && (
          <div role="alert" className="flex gap-3 rounded-[2px] border border-high-mark/50 bg-high-tint p-4 text-high">
            <WarningCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" weight="bold" />
            <div className="min-w-0">
              <p className="font-semibold">{run.message}</p>
              {run.message.includes("couldn't analyze this contract right now") && (
                <button type="button" onClick={() => void analyze()} className="btn btn-primary mt-3">
                  Try again <ArrowRight aria-hidden="true" className="h-4 w-4" weight="bold" />
                </button>
              )}
              {run.detail != null && (
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-2">
                  {JSON.stringify(run.detail, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
        {run.status === "done" && <ReportView report={run.report} contractText={run.contractText} meta={run.meta} onSealed={(seal) => saveReviewHistory({ report: run.report, contractText: run.contractText, meta: run.meta, sealed: seal })} />}
      </div>
    </div>
  );
}
