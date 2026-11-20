"use client";

/** iOS-style switch. A real checkbox underneath, so keyboard and screen readers just work. */
export function Switch({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="h-[31px] w-[51px] rounded-full bg-surface-2 ring-1 ring-hairline transition-colors duration-200 peer-checked:bg-accent peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-text)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ease-out peer-checked:translate-x-5"
      />
    </span>
  );
}
