"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, CircleAlert, Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { ActionResult } from "@/lib/admin/actions-kit";

type Action = (state: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * A form posting to an admin server action. Shows "Saved" / the error right under the button.
 * `confirm` asks first (for deletes). `resetOnSuccess` clears "add new" forms after saving.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  confirm,
  resetOnSuccess = false,
  danger = false,
  className = "",
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  danger?: boolean;
  className?: string;
  /** Button and message on one line (for small row forms). */
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={inline ? `flex flex-wrap items-center gap-2 ${className}` : `flex flex-col gap-4 ${className}`}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton danger={danger}>{submitLabel}</SubmitButton>
        {state && (
          <p role="status" className={`flex items-center gap-1.5 text-[14px] font-medium ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-accent-text"}`}>
            {state.ok ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function SubmitButton({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold disabled:opacity-60 ${
        danger ? "bg-surface-2 text-accent-text ring-1 ring-hairline hover:bg-accent-soft" : "bg-accent text-on-accent hover:bg-accent-pressed"
      }`}
    >
      {pending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export type Column = { key: string; label: string; placeholder?: string; width?: string; required?: boolean };

/**
 * Editable list of rows (fill-in options, lesson words, notes). Submitted as JSON in a hidden
 * input named `name`. Rows can be added, removed and moved.
 */
export function RowsEditor({
  name,
  columns,
  initial,
  addLabel = "Add row",
}: {
  name: string;
  columns: Column[];
  initial: Record<string, string>[];
  addLabel?: string;
}) {
  const [rows, setRows] = useState(initial);
  // After a save the page re-renders with the stored rows (e.g. new words now have ids):
  // start from those, or saving again would add the new rows a second time.
  const initialKey = JSON.stringify(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setRows(initial);
  }
  const update = (i: number, key: string, value: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  const move = (i: number, by: number) =>
    setRows((r) => {
      const next = [...r];
      const [row] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, row);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl ring-1 ring-hairline">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead className="bg-surface-2 text-left text-[12px] text-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 font-medium" style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                <th className="w-[96px] px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-hairline">
                  {columns.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <input
                        aria-label={`${c.label}, row ${i + 1}`}
                        value={row[c.key] ?? ""}
                        placeholder={c.placeholder}
                        required={c.required}
                        onChange={(e) => update(i, c.key, e.target.value)}
                        className="h-9 w-full rounded-lg bg-surface-2 px-2 outline-none focus:ring-2 focus:ring-accent-text/40"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <div className="flex justify-end gap-0.5">
                      <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Remove row" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, Object.fromEntries(columns.map((c) => [c.key, ""]))])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent-text ring-1 ring-hairline hover:bg-accent-soft"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
