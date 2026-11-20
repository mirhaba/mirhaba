import { Loader2 } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

type Variant = "primary" | "secondary" | "plain";

const styles: Record<Variant, string> = {
  // The one filled accent button per screen: the main action.
  primary: "bg-accent text-on-accent hover:bg-accent-pressed disabled:bg-accent/50",
  // Quiet surface button for alternatives.
  secondary: "bg-surface text-foreground shadow-card ring-1 ring-hairline hover:bg-surface-2 disabled:opacity-50",
  // Text-only, for low-priority actions.
  plain: "text-accent-text hover:bg-accent-soft disabled:opacity-50",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`pressable inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[17px] font-semibold disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {loading && <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}
