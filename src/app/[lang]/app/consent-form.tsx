"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { useState, useTransition } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { acceptConsent } from "./actions";

/** One-time consent after first sign-in. Both boxes start unticked; only the first is required. */
export function ConsentForm({ lang, t }: { lang: Locale; t: Messages["consent"] }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [accepted, setAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="fade-in flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!accepted) {
          setShowRequired(true);
          return;
        }
        setFailed(false);
        startTransition(async () => {
          const result = await acceptConsent({ accepted, marketing });
          // Continue where the person was going (e.g. the translate page), else show the account.
          if (!result.ok) setFailed(true);
          else if (next) router.replace(safeNextPath(next, lang));
          else router.refresh();
        });
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[22px] font-semibold">{t.title}</h2>
          <p className="text-[15px] text-muted">{t.body}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        <Checkbox
          id="consent-terms"
          checked={accepted}
          onChange={(v) => {
            setAccepted(v);
            if (v) setShowRequired(false);
          }}
          label={t.ageTerms}
          invalid={showRequired}
          describedBy={showRequired ? "consent-terms-error" : undefined}
        />
        <Checkbox id="consent-marketing" checked={marketing} onChange={setMarketing} label={t.marketing} />
      </div>
      {showRequired && (
        <p id="consent-terms-error" role="alert" className="fade-in -mt-3 flex items-center gap-1.5 text-[13px] font-medium text-accent-text">
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {t.required}
        </p>
      )}

      <p className="flex flex-wrap gap-x-3 text-[15px]">
        <Link href={`/${lang}/legal/terms`} className="inline-flex min-h-11 items-center font-medium text-accent-text">
          {t.readTerms}
        </Link>
        <Link href={`/${lang}/legal/privacy`} className="inline-flex min-h-11 items-center font-medium text-accent-text">
          {t.readPrivacy}
        </Link>
      </p>

      {failed && (
        <p role="alert" className="fade-in rounded-xl bg-accent-soft px-4 py-3 text-[15px] font-medium text-accent-text">
          {t.saveError}
        </p>
      )}

      <Button type="submit" loading={pending}>
        {t.continue}
      </Button>
    </form>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 border-b border-hairline px-4 py-3.5 last:border-b-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-md accent-[var(--accent)] aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-[var(--accent-text)]"
      />
      <span className="text-[15px] leading-snug">{label}</span>
    </label>
  );
}
