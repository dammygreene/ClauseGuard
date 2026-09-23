"use client";

import { useState } from "react";
import { CheckCircle, Copy, ShieldCheck } from "@phosphor-icons/react";
import type { ContractReport, SealRecord } from "@/types/report";
import { verifySeal } from "@/lib/seal";

export function SealCertificate({ report, contractText, seal }: { report: ContractReport; contractText: string; seal: SealRecord }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  async function verify() {
    setVerified(await verifySeal(contractText, report, seal));
  }

  async function copyLink() {
    await navigator.clipboard.writeText(seal.explorerUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="document-sheet mt-8 border-2 border-accent bg-sheet p-6 sm:p-8" aria-labelledby="certificate-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="h-8 w-8 text-accent" weight="duotone" />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Sealed review</p>
            <h3 id="certificate-heading" className="mt-1 font-serif text-2xl font-semibold text-ink">{report.contractTitle}</h3>
          </div>
        </div>
        <span className="font-mono text-xs text-muted">Base Sepolia</span>
      </div>
      <p className="mt-5 max-w-[65ch] leading-relaxed text-ink-2">A cryptographic fingerprint of this contract and report was recorded on-chain. The contract contents remain private.</p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Contract hash</dt><dd className="mt-1 break-all font-mono text-xs text-ink-2">{seal.contractHash}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Report hash</dt><dd className="mt-1 break-all font-mono text-xs text-ink-2">{seal.reportHash}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Sealed at</dt><dd className="mt-1 text-sm text-ink-2">{new Date(seal.timestamp).toLocaleString()}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Transaction</dt><dd className="mt-1 break-all font-mono text-xs text-ink-2">{seal.txHash}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <button type="button" onClick={() => void verify()} className="btn btn-primary"><CheckCircle aria-hidden="true" className="h-4 w-4" weight="bold" /> Verify on-chain</button>
        <a className="btn btn-secondary" href={seal.explorerUrl} target="_blank" rel="noreferrer">View transaction</a>
        <button type="button" onClick={() => void copyLink()} className="btn btn-quiet">{copied ? <CheckCircle aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}</button>
        {verified !== null && <span className={verified ? "text-sm font-semibold text-low" : "text-sm font-semibold text-high"}>{verified ? "Hashes match the on-chain record." : "Verification did not match."}</span>}
      </div>
    </section>
  );
}
