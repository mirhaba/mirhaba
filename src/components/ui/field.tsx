import { CircleAlert } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

/**
 * Text field with a visible label above it and its error right underneath
 * (never a placeholder used as a label, never errors collected at the bottom).
 */
export function Field({
  id,
  label,
  error,
  hint,
  className = "",
  ...input
}: ComponentPropsWithRef<"input"> & { id: string; label: string; error?: string; hint?: string }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        className={`h-12 w-full rounded-xl bg-surface-2 px-4 text-[17px] transition-shadow duration-150 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40 aria-invalid:ring-2 aria-invalid:ring-accent-text ${className}`}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="fade-in mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-accent-text">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
