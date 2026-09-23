"use client";

import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { FileArrowUp, FileText, CircleNotch, WarningCircle, X } from "@phosphor-icons/react";

export interface ParsedFile {
  text: string;
  kind: "pdf" | "docx" | "txt";
  pages?: number;
  words: number;
  chars: number;
  fileName: string;
}

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_BYTES = 4 * 1024 * 1024;

type State =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "done"; file: ParsedFile }
  | { status: "error"; fileName?: string; message: string };

export function UploadDropzone({
  onParsed,
  onClear,
}: {
  onParsed: (file: ParsedFile) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const statusId = useId();

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setState({ status: "error", fileName: file.name, message: "That file is larger than 4 MB. Try a smaller export, or paste the text instead." });
      return;
    }
    setState({ status: "parsing", fileName: file.name });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/parse", { method: "POST", body });
      const data = await res.json().catch(() => ({ error: "The server returned an unexpected response." }));
      if (!res.ok) {
        setState({ status: "error", fileName: file.name, message: data.error ?? "We couldn't read that file." });
        onClear();
        return;
      }
      setState({ status: "done", file: data as ParsedFile });
      onParsed(data as ParsedFile);
    } catch {
      setState({ status: "error", fileName: file.name, message: "Upload failed. Check your connection and try again." });
      onClear();
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function open() {
    inputRef.current?.click();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  }

  function reset() {
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }

  if (state.status === "done") {
    const f = state.file;
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[2px] border border-rule-strong bg-sheet p-4" role="status" id={statusId}>
        <FileText aria-hidden="true" className="h-8 w-8 shrink-0 text-accent" weight="light" />
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-ink">{f.fileName}</p>
          <p className="text-sm text-muted">
            {f.kind.toUpperCase()}
            {f.pages ? ` · ${f.pages} ${f.pages === 1 ? "page" : "pages"}` : ""} · {f.words.toLocaleString()} words extracted
          </p>
        </div>
        <button type="button" onClick={reset} className="btn btn-quiet text-sm">
          <X aria-hidden="true" className="h-4 w-4" /> Remove
        </button>
      </div>
    );
  }

  const parsing = state.status === "parsing";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-describedby={statusId}
        aria-busy={parsing}
        onClick={parsing ? undefined : open}
        onKeyDown={parsing ? undefined : onKey}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[2px] border border-dashed px-6 py-10 text-center transition-colors duration-150 ${
          dragging ? "border-accent bg-accent-soft" : "border-rule-strong bg-sheet hover:border-ink-2 hover:bg-paper-2"
        }`}
      >
        {parsing ? (
          <CircleNotch aria-hidden="true" className="h-9 w-9 animate-spin text-accent motion-reduce:animate-none" />
        ) : (
          <FileArrowUp aria-hidden="true" className="h-9 w-9 text-accent" weight="light" />
        )}
        <p className="text-base font-medium text-ink">
          {parsing ? `Reading ${state.fileName}…` : "Drop a contract here, or click to choose a file"}
        </p>
        <p className="text-sm text-muted">PDF, DOCX or TXT, up to 4 MB. Scanned images can&apos;t be read.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div id={statusId} aria-live="polite" className="mt-2 min-h-[1.25rem]">
        {state.status === "error" && (
          <p className="flex items-start gap-1.5 text-sm font-medium text-high">
            <WarningCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" weight="bold" />
            <span>
              {state.fileName ? <span className="break-all">{state.fileName}: </span> : null}
              {state.message}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
