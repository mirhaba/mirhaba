import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCheck, Inbox, ShieldX } from "lucide-react";
import { hasLocale, intlLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { StateView } from "@/components/state-view";
import { ReviewButtons } from "./review-buttons";

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export async function generateMetadata({ params }: PageProps<"/[lang]/app/moderation">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.moderation.title, robots: { index: false, follow: false } };
}

export default async function ModerationPage({ params, searchParams }: PageProps<"/[lang]/app/moderation">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.moderation.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.moderation.subtitle}</p>
      </div>
      <Suspense fallback={<QueueSkeleton />}>
        <Queue lang={lang} t={t} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Queue({
  lang,
  t,
  searchParams,
}: {
  lang: Locale;
  t: Messages;
  searchParams: PageProps<"/[lang]/app/moderation">["searchParams"];
}) {
  const supabase = await createClient();
  const { data: isModerator } = await supabase.rpc("is_moderator");
  if (!isModerator) {
    return (
      <StateView
        Icon={ShieldX}
        tone="error"
        headingLevel={2}
        title={t.moderation.noAccessTitle}
        body={t.moderation.noAccessBody}
        action={{ label: t.moderation.back, href: `/${lang}/app` }}
      />
    );
  }

  const requested = (await searchParams).status;
  const status: Status = STATUSES.includes(requested as Status) ? (requested as Status) : "pending";

  const [{ data: items, error }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("corrections")
      .select("id, free_text, direction, source_text, output_text, suggestion, status, created_at")
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" }) // oldest pending first
      .limit(50),
    supabase.from("corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (error) throw error; // shows the route's error screen with a retry button

  const date = new Intl.DateTimeFormat(intlLocale[lang], { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.moderation.tabs} className="flex rounded-xl bg-surface-2 p-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${lang}/app/moderation${s === "pending" ? "" : `?status=${s}`}`}
            aria-current={s === status ? "page" : undefined}
            className={`pressable flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold ${
              s === status ? "bg-surface text-foreground shadow-card" : "text-muted"
            }`}
          >
            {t.moderation[s]}
            {s === "pending" && !!pendingCount && (
              <span className="rounded-full bg-accent px-1.5 text-[12px] leading-5 text-on-accent tabular-nums">{pendingCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {!items?.length ? (
        <StateView
          Icon={status === "pending" ? CheckCheck : Inbox}
          headingLevel={2}
          title={status === "pending" ? t.moderation.emptyPending : t.moderation.emptyReviewed}
          body={status === "pending" ? t.moderation.emptyPendingBody : t.moderation.emptyReviewedBody}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li
              key={item.id}
              style={{ "--i": i } as React.CSSProperties}
              className="fade-in overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline"
            >
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[13px] font-medium text-muted">{t.moderation.source}</p>
                  {/* Plain text rendering: user content is never injected as HTML. */}
                  <p className="mt-0.5 text-[15px] whitespace-pre-wrap break-words">
                    {item.source_text
                      ? `[${item.direction}] ${item.source_text}\n→ ${item.output_text ?? ""}`
                      : item.free_text}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-muted">{t.moderation.suggestion}</p>
                  <p className="mt-0.5 text-[17px] font-semibold whitespace-pre-wrap break-words">{item.suggestion}</p>
                </div>
                <p className="text-[13px] text-muted">
                  {t.moderation.sent}: {date.format(new Date(item.created_at))}
                </p>
              </div>
              {status === "pending" && <ReviewButtons id={item.id} t={t.moderation} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="skeleton h-12 rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-hairline">
          <div className="skeleton h-3.5 w-28 rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
          <div className="skeleton h-3.5 w-32 rounded" />
          <div className="skeleton h-5 w-3/5 rounded" />
        </div>
      ))}
    </div>
  );
}
