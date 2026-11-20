// Mirhaba logo: the H3 mark (two speech bubbles linked by a dotted arc) + "mirhaba" wordmark.
// Geometry is final (public/brand/mirhaba-mark.svg); do not redraw.

type Variant = "light" | "dark" | "auto";
type Size = "sm" | "md" | "lg";

const MARK_HEIGHT: Record<Size, number> = { sm: 24, md: 32, lg: 48 };
// Wordmark size scaled to the mark: the text cap-height sits within the bubbles' height.
const TEXT_SIZE: Record<Size, number> = { sm: 18, md: 24, lg: 36 };

const COLORS: Record<Variant, { arc: string; left: string; right: string; text: string }> = {
  light: { arc: "#1E1A22", left: "#C1272D", right: "#1E1A22", text: "#1E1A22" },
  dark: { arc: "#E3B23C", left: "#C1272D", right: "#FBF9F8", text: "#FBF9F8" },
  // Follows the page theme (CSS variables switch under prefers-color-scheme: dark).
  auto: { arc: "var(--logo-arc)", left: "var(--logo-left)", right: "var(--logo-right)", text: "var(--logo-text)" },
};

const BUBBLE =
  "M12 2 H28 A10 10 0 0 1 38 12 V16 A10 10 0 0 1 28 26 H20 L9 34 L11 26 A10 10 0 0 1 2 16 V12 A10 10 0 0 1 12 2 Z";

export function LogoMark({ variant = "auto", height = 32, className }: { variant?: Variant; height?: number; className?: string }) {
  const c = COLORS[variant];
  return (
    <svg
      viewBox="0 0 300 180"
      width={(height * 300) / 180}
      height={height}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M70 112 Q150 10 230 112"
        fill="none"
        stroke={c.arc}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="1 22"
      />
      <path d={BUBBLE} fill={c.left} transform="translate(16 108) scale(1.8)" />
      <path d={BUBBLE} fill={c.right} transform="translate(284 108) scale(-1.8 1.8)" />
    </svg>
  );
}

/**
 * Mark + lowercase wordmark. The mark is aria-hidden; wrap the logo in a link with
 * aria-label="Mirhaba" (or rely on the visible word) so the name is read once.
 */
export function Logo({
  variant = "auto",
  size = "md",
  showWordmark = true,
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  showWordmark?: boolean;
  className?: string;
}) {
  const height = MARK_HEIGHT[size];
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: height * 0.4 }}>
      <LogoMark variant={variant} height={height} />
      {showWordmark && (
        <span
          aria-hidden="true"
          className="font-sans leading-none font-bold"
          style={{ fontSize: TEXT_SIZE[size], letterSpacing: "-0.03em", color: COLORS[variant].text }}
        >
          mirhaba
        </span>
      )}
    </span>
  );
}
