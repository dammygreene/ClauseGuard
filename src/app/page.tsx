import Link from "next/link";
import { ArrowRight, HighlighterCircle, Scales, SealCheck, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { RiskBadge } from "@/components/RiskBadge";

/**
 * Landing. Split hero (taste-skill 4.3: no centred hero at VARIANCE 5): copy on the left,
 * a real excerpt from the sample contract with ClauseGuard's actual highlight treatment on
 * the right, so the first thing a visitor sees is the product's core idea: your document,
 * annotated.
 */
export default function Home() {
  return (
    <>
      <section className="hero-stage relative isolate mx-auto grid w-full max-w-[1280px] items-center gap-10 overflow-hidden px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-16">
        <div className="max-w-[40rem]">
          <h1 className="text-balance font-serif text-[2.375rem] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl lg:text-[3.25rem]">
            Know what you&apos;re signing, before you sign it.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-2">
            For freelancers, contractors and gig workers: find the clauses that could cost you, in plain English, with fairer wording to send back.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/analyze" className="btn btn-primary h-12 px-6 text-base">
              Analyze a contract <ArrowRight aria-hidden="true" className="h-4 w-4" weight="bold" />
            </Link>
            <Link href="#how-it-works" className="btn btn-quiet h-12 text-base text-muted hover:text-ink">
              How it works
            </Link>
          </div>
          <div className="seal-hint mt-8 flex max-w-[22rem] items-center gap-3 border-l-2 border-medium-mark pl-3 text-sm text-ink-2">
            <SealCheck aria-hidden="true" className="h-6 w-6 shrink-0 text-medium-mark" weight="duotone" />
            <span>A review you can prove you made, without publishing the contract.</span>
          </div>
        </div>

        <figure className="min-w-0" aria-label="Example: a contract with risky clauses highlighted">
          <div className="hero-document rounded-[2px] bg-sheet p-6 sm:p-8">
            <p className="font-mono text-xs text-muted">Section 2.2 · Payment</p>
            <p className="doc-text mt-2 text-[1rem]">
              Company will pay undisputed invoices within ninety (90) days{" "}
              <mark className="rounded-[1px] bg-high-tint text-ink underline decoration-high-mark decoration-2 underline-offset-4">
                after Company has received payment in full from the end client
              </mark>{" "}
              for the work covered by the invoice.
            </p>
            <div className="mt-4 border-l-2 border-high-mark pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level="high" size="sm" />
                <span className="text-sm font-medium text-ink">Payment Terms</span>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
                You only get paid after the agency&apos;s client pays them. If that client never pays, neither do you.
              </p>
            </div>
            <hr className="my-6 border-rule" />
            <p className="font-mono text-xs text-muted">Section 8 · Governing law</p>
            <p className="doc-text mt-2 text-[1rem]">
              <mark className="rounded-[1px] bg-low-tint text-ink underline decoration-low-mark decoration-2 underline-offset-4">
                This Agreement is governed by the laws of the State of Oregon.
              </mark>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RiskBadge level="low" size="sm" />
              <span className="text-sm text-muted">Standard, worth knowing.</span>
            </div>
          </div>
          <figcaption className="mt-3 text-sm text-muted">Excerpts from ClauseGuard&apos;s sample contracts.</figcaption>
        </figure>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="border-t border-rule bg-paper-2">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-14 sm:px-6 lg:py-16">
          <h2 id="how-heading" className="font-serif text-3xl font-semibold tracking-[-0.015em] text-ink">
            How it works
          </h2>
          <ol className="mt-8 grid gap-0 md:grid-cols-3">
            <li className="how-step border-t-2 border-ink pt-4 md:pr-8">
              <UploadSimple aria-hidden="true" className="mb-5 h-7 w-7 text-accent" weight="duotone" />
              <h3 className="text-lg font-semibold text-ink">Upload</h3>
              <p className="mt-2 leading-relaxed text-ink-2">Paste the text or drop in a PDF or Word file. No account needed.</p>
            </li>
            <li className="how-step border-t-2 border-ink pt-4 md:border-l md:px-8">
              <HighlighterCircle aria-hidden="true" className="mb-5 h-7 w-7 text-high-mark" weight="duotone" />
              <h3 className="text-lg font-semibold text-ink">Review flagged clauses</h3>
              <p className="mt-2 leading-relaxed text-ink-2">
                Each risky clause is highlighted in your document, rated, explained, and paired with fairer wording you can copy.
              </p>
            </li>
            <li className="how-step border-t-2 border-ink pt-4 md:border-l md:pl-8">
              <SealCheck aria-hidden="true" className="mb-5 h-7 w-7 text-medium-mark" weight="duotone" />
              <h3 className="text-lg font-semibold text-ink">Seal your review</h3>
              <p className="mt-2 leading-relaxed text-ink-2">
                Record a tamper-proof fingerprint of the contract and report on a public blockchain, as proof of what you reviewed and when.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section aria-label="About this tool" className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 sm:px-6">
          <Scales aria-hidden="true" className="h-6 w-6 shrink-0 text-accent" />
          <p className="text-[0.9375rem] text-ink">
            <strong className="font-semibold">Not legal advice.</strong> A first line of defense before you sign. ClauseGuard uses AI and can miss things; for high-stakes contracts, talk to a lawyer.
          </p>
        </div>
      </section>
    </>
  );
}
