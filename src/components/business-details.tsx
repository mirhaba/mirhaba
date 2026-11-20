import type { Messages } from "@/i18n/dictionaries";
import { business, isBusinessRegistered } from "@/lib/business";

/**
 * Company name, registration number, address and contact, as required by the bank's
 * e-commerce audit. Only filled values are shown; until registration, a short notice.
 */
export function BusinessDetails({ t, variant = "list" }: { t: Messages["footer"]; variant?: "list" | "inline" }) {
  const rows = [
    { label: t.company, value: business.name },
    { label: t.registration, value: business.registrationNumber },
    { label: t.fiscal, value: business.fiscalNumber },
    { label: t.address, value: business.address },
    { label: t.phone, value: business.phone },
  ].filter((r) => r.value);

  const email = (
    <a href={`mailto:${business.email}`} className="underline-offset-2 hover:text-foreground hover:underline">
      {business.email}
    </a>
  );

  if (variant === "inline") {
    return (
      <p className="mt-2">
        {rows.map((r) => (
          <span key={r.label}>
            {r.label}: {r.value} ·{" "}
          </span>
        ))}
        {t.email}: {email}
        {!isBusinessRegistered && <span className="block">{t.companyPending}</span>}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <dl className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        {[...rows, { label: t.email, value: email }].map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
            <dt className="shrink-0 text-[15px] text-muted">{r.label}</dt>
            <dd className="text-right text-[15px]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {!isBusinessRegistered && <p className="mt-2 text-[13px] text-muted">{t.companyPending}</p>}
    </div>
  );
}
