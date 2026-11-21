// Small server-safe building blocks for admin pages (layout, fields, tables).

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export const inputClass =
  "h-10 w-full rounded-xl bg-surface-2 px-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-2 focus:ring-accent-text/40";
export const textareaClass =
  "min-h-20 w-full rounded-xl bg-surface-2 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-accent-text/40";

export function PageHeader({ title, description, back, actions }: { title: string; description?: string; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-[14px] font-medium text-accent-text">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, description, children, className = "" }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-surface p-5 shadow-card ring-1 ring-hairline ${className}`}>
      {title && <h2 className="text-[18px] font-semibold">{title}</h2>}
      {description && <p className="mt-0.5 text-[14px] text-muted">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid gap-4 ${c}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "accent" }) {
  const t = {
    neutral: "bg-surface-2 text-muted",
    good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    accent: "bg-accent-soft text-accent-text",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${t}`}>{children}</span>;
}

/** A list of links to sub-pages (e.g. phrases in a category). */
export function LinkList({ items, empty }: { items: { href: string; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode }[]; empty: string }) {
  if (!items.length) return <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-[15px] text-muted">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
      {items.map((item, i) => (
        <li key={i} className="border-b border-hairline last:border-b-0">
          <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{item.title}</span>
              {item.subtitle && <span className="block truncate text-[14px] text-muted">{item.subtitle}</span>}
            </span>
            {item.meta}
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted/60" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SearchForm({ placeholder, defaultValue, children }: { placeholder: string; defaultValue?: string; children?: ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap gap-2" role="search">
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className={`${inputClass} max-w-md flex-1`} />
      {children}
      <button className="h-10 rounded-full bg-surface-2 px-4 text-[15px] font-semibold ring-1 ring-hairline hover:bg-hairline">Search</button>
    </form>
  );
}
