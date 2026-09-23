import { RISK_LABELS, type RiskLevel } from "@/types/report";

const TONES: Record<RiskLevel, { bar: string; fill: string }> = {
  high: { bar: "bg-high-tint", fill: "bg-high-mark" },
  medium: { bar: "bg-medium-tint", fill: "bg-medium-mark" },
  low: { bar: "bg-low-tint", fill: "bg-low-mark" },
};

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const tone = TONES[level];
  return (
    <div aria-label={`Overall risk: ${RISK_LABELS[level]}, ${score} out of 100`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Overall risk</p>
          <p className="mt-1 font-serif text-4xl font-semibold leading-none text-ink">
            {score}<span className="ml-1 text-lg font-normal text-muted">/100</span>
          </p>
        </div>
        <span className="font-mono text-xs text-muted">{RISK_LABELS[level]}</span>
      </div>
      <div className={`mt-4 h-2 w-full overflow-hidden rounded-full ${tone.bar}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className={`h-full origin-left ${tone.fill} motion-safe:animate-[meter-in_450ms_ease-out]`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
