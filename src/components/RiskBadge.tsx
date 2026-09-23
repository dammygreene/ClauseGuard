import { CheckCircle, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { RISK_LABELS, type RiskLevel } from "@/types/report";

const STYLES: Record<RiskLevel, string> = {
  high: "bg-high-tint text-high ring-high-mark/40",
  medium: "bg-medium-tint text-medium ring-medium-mark/45",
  low: "bg-low-tint text-low ring-low-mark/40",
};

const ICONS = { high: WarningOctagon, medium: Warning, low: CheckCircle } as const;

/**
 * Risk is never communicated by colour alone: every badge has a distinct icon shape AND a
 * text label. Badges never wrap internally (whitespace-nowrap); parent rows wrap instead.
 */
export function RiskBadge({
  level,
  size = "md",
  short = false,
}: {
  level: RiskLevel;
  size?: "sm" | "md";
  /** "High" instead of "High risk", for dense contexts where "risk" is implied by a heading. */
  short?: boolean;
}) {
  const Icon = ICONS[level];
  const label = short ? RISK_LABELS[level].replace(" risk", "") : RISK_LABELS[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${STYLES[level]} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[0.8125rem]"
      }`}
    >
      <Icon weight="bold" aria-hidden="true" className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </span>
  );
}
