/**
 * Brand mark: a section sign inside a seal ring. This is the one piece of custom SVG in the
 * app; it is a logo, not decoration, so it sits outside taste-skill's hand-rolled SVG rule.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.2 1.6" />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fontFamily="var(--font-serif)"
        fontSize="16"
        fontWeight="600"
        fill="currentColor"
      >
        §
      </text>
    </svg>
  );
}
