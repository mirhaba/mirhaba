"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

/** Password input with a visible label, a show/hide button, and its hint or error right underneath. */
export function PasswordField({
  id,
  label,
  error,
  hint,
  showLabel,
  hideLabel,
  ...input
}: Omit<ComponentPropsWithRef<"input">, "type"> & { id: string; label: string; error?: string; hint?: string; showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...input}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className="h-12 w-full rounded-xl bg-surface-2 pr-12 pl-4 text-[17px] transition-shadow duration-150 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40 aria-invalid:ring-2 aria-invalid:ring-accent-text"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="pressable absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>
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
