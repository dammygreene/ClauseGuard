# ClauseGuard — Blueprint

## 1. One-line pitch
ClauseGuard is a plain-language contract risk analyzer built for freelancers, gig workers, and independent contractors — it reads any contract, flags the clauses that could hurt you (IP grabs, bad payment terms, one-sided termination, non-competes, jurisdiction traps), explains the risk in plain English, suggests a fairer redline, and lets you seal a tamper-proof, timestamped record of the review on-chain.

## 2. The problem
Freelancers and independent contractors sign contracts constantly — from agencies, intermediaries, one-off clients, platforms — and almost never have access to a lawyer to review them. Standard contract templates are written by (and for) the party with more leverage. The result: unpaid IP assignment, net-90 payment terms, unilateral termination with no kill fee, exclusivity clauses with no compensation, and jurisdiction clauses that make disputes practically unwinnable for the smaller party.

This is not a hypothetical — it is the daily reality of subcontracted development work, especially work sourced through intermediary agencies where the contractor has the least negotiating power and the least visibility into what "standard" language actually costs them.

## 3. Who it's for
- **Primary user:** independent contractors and freelancers (dev, design, writing, consulting) receiving contracts from clients or agencies.
- **Secondary user:** small agencies/studios who want to sanity-check contracts before sending them to contractors (trust-building angle).
- **Judge-facing framing (LexHack):** "access to justice" for a population — gig workers — that is large, growing, and almost entirely priced out of legal review.

## 4. Core value proposition
1. **Understand fast** — paste or upload a contract, get a risk breakdown in under 30 seconds, no legal training required.
2. **Know exactly what's dangerous** — every flagged clause gets a risk tier (High / Medium / Low), a plain-English explanation of what it actually means for you, and why it matters.
3. **Act on it** — each flagged clause comes with a suggested redline: fairer language you can propose back.
4. **Prove you reviewed it** — "Seal Review" hashes the contract + the risk report and timestamps it on a public testnet, producing a verifiable certificate. This matters if a dispute ever comes up: proof you reviewed and flagged specific risks before signing.

## 5. MVP feature scope (build this, nothing more)
**In scope:**
- Contract input: paste text OR upload PDF/DOCX
- Clause extraction + classification into 6 categories:
  1. IP / Ownership
  2. Payment Terms
  3. Termination
  4. Liability / Indemnification
  5. Non-Compete / Exclusivity
  6. Jurisdiction / Dispute Resolution
- Per-clause risk score (High / Medium / Low) with plain-English "what this means for you"
- Overall contract risk score (aggregate, shown prominently)
- Suggested redline text per flagged clause (copyable)
- "Seal Review" action: hash contract text + report JSON → write hash + timestamp to a testnet smart contract → return a shareable certificate (view on block explorer)
- Review history: list of past contracts reviewed in this session/account (local storage or simple DB — see Data Model)
- Clean, credible, non-generic UI (see design.md / ui-ux.md)

**Explicitly out of scope for the hackathon MVP:**
- User accounts / auth beyond a lightweight session or wallet-connect
- Full legal-jurisdiction-specific analysis (US-generic contract law only, disclaimer clearly stated)
- Multi-language contracts
- Real legal advice / attorney matching
- Contract negotiation chat / back-and-forth redlining tool
- Mobile app (responsive web is enough)

## 6. Tech architecture

```
┌─────────────────────────┐
│      Next.js App         │
│  (App Router, TS, React) │
└───────────┬───────────────┘
            │
   ┌────────┴─────────┐
   │                   │
┌──▼───────┐   ┌───────▼────────┐
│ /api/    │   │ /api/seal      │
│ analyze  │   │ (on-chain hash)│
└──┬───────┘   └───────┬────────┘
   │                   │
┌──▼─────────────┐  ┌──▼─────────────────┐
│ LLM (Claude/   │  │ ethers.js / viem    │
│ OpenRouter)    │  │ → Testnet contract   │
│ clause extract │  │ (Sepolia / Base      │
│ + risk scoring │  │  Sepolia)            │
└────────────────┘  └──────────────────────┘
```

**Stack:**
- **Frontend/Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **File parsing:** `pdf-parse` for PDF, `mammoth` for DOCX, plain textarea for paste
- **LLM:** Claude (Anthropic API) or a free-tier model via OpenRouter — used for clause extraction, classification, risk scoring, and redline generation. Structured JSON output (see Data Model below).
- **On-chain sealing:** `ethers.js` or `viem` + `wagmi`, targeting a public testnet (Sepolia or Base Sepolia). A minimal Solidity contract (`ClauseGuardRegistry.sol`) stores `(bytes32 contractHash, bytes32 reportHash, uint256 timestamp, address sender)`.
- **Storage:** For the MVP, browser localStorage or a lightweight SQLite/Supabase free-tier table for review history — no need for a full backend DB.
- **Hosting:** Vercel (free tier).

## 7. Data model

### ClauseFinding
```ts
interface ClauseFinding {
  id: string;
  category: "ip_ownership" | "payment_terms" | "termination" | "liability" | "non_compete" | "jurisdiction";
  clauseText: string;        // the exact excerpt from the contract
  riskLevel: "high" | "medium" | "low";
  riskExplanation: string;   // plain-English, 1-3 sentences
  suggestedRedline: string;  // fairer alternative language
  locationHint?: string;     // e.g. "Section 4.2" if detectable
}
```

### ContractReport
```ts
interface ContractReport {
  id: string;
  createdAt: string;         // ISO timestamp
  contractTitle: string;     // user-provided or inferred
  overallRiskScore: number;  // 0-100, higher = riskier
  overallRiskLevel: "high" | "medium" | "low";
  findings: ClauseFinding[];
  summary: string;           // 2-3 sentence plain-English TL;DR
  sealed?: {
    contractHash: string;
    reportHash: string;
    txHash: string;
    chainId: number;
    timestamp: string;
    explorerUrl: string;
  };
}
```

## 8. LLM prompting strategy
- Single structured-output call (or two-step: extract → score) that returns strict JSON matching `ContractReport`.
- System prompt should instruct the model to:
  - Only flag clauses that fall into the 6 defined categories.
  - Never invent clauses not present in the source text.
  - Keep every explanation in plain English, addressed directly to "you" (the contractor).
  - Always propose a redline that is realistic and could actually be sent back to a client — not aggressive, not legally reckless.
  - Include a disclaimer note in the summary: this is not legal advice.

## 9. On-chain sealing flow
1. User clicks "Seal Review" after reviewing the report.
2. Client hashes the raw contract text (SHA-256) and the report JSON (SHA-256).
3. Client calls `registerReview(contractHash, reportHash)` on `ClauseGuardRegistry.sol` via the connected wallet (or a backend-managed relayer wallet for users without a wallet — recommended for demo smoothness, see below).
4. Contract emits `ReviewSealed(address indexed sender, bytes32 contractHash, bytes32 reportHash, uint256 timestamp)`.
5. UI shows a certificate: tx hash, block explorer link, timestamp, both hashes, and a "Verify" button that recomputes hashes client-side and checks against on-chain values.

**Demo-safety recommendation:** For the hackathon demo, use a backend-managed relayer wallet (funded with testnet ETH from a faucet) so judges don't need to connect a wallet to see the full flow. Offer wallet-connect as an optional "sign with your own wallet" path if time allows — but don't make it required for the demo to work.

## 10. Success criteria for the hackathon submission
- A user can go from "paste contract" to "full risk report" in under 60 seconds, live, in the demo video.
- At least one clause per category type is correctly identified in a realistic sample contract.
- The "Seal Review" flow completes on-chain and the certificate is verifiable on a public block explorer.
- The UI looks distinctive and premium — not a generic AI-wrapper template (see design.md and ui-ux.md).
- The Devpost writeup and video clearly state: real problem → who it's for → how it works → live demo → what makes it different (freelancer focus + verifiable proof-of-review).
