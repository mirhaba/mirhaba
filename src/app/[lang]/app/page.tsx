import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { hasLocale, intlLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/billing/entitlement";
import { getAdmin } from "@/lib/admin/auth";
import { AccountSettings } from "./account-settings";
import { ConsentForm } from "./consent-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/app">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/app">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-[34px] leading-tight font-bold">{t.account.title}</h1>
      {/* Reading the session happens per request, so only this part waits. */}
      <Suspense fallback={<AccountSkeleton />}>
        <Account lang={lang} t={t} />
      </Suspense>
    </div>
  );
}

async function Account({ lang, t }: { lang: Locale; t: Messages }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/${lang}/login?next=/${lang}/app`); // the proxy already guards; this is defence in depth

  const [{ data: profile }, entitlement, { data: isModerator }, admin] = await Promise.all([
    supabase.from("profiles").select("ui_lang, marketing_opt_in, age_confirmed_at").eq("id", auth.user.id).single(),
    getEntitlement(),
    supabase.rpc("is_moderator"),
    getAdmin(),
  ]);

  if (!profile?.age_confirmed_at) return <ConsentForm lang={lang} t={t.consent} />;

  const activeUntil = entitlement.activeUntil
    ? new Intl.DateTimeFormat(intlLocale[lang], { dateStyle: "long" }).format(new Date(entitlement.activeUntil))
    : null;

  return (
    <AccountSettings
      lang={lang}
      t={t.account}
      email={auth.user.email ?? ""}
      marketing={profile.marketing_opt_in}
      activeUntil={activeUntil}
      moderationLink={isModerator && !admin ? { href: `/${lang}/app/moderation`, label: t.moderation.open, hint: t.moderation.openHint } : null}
      adminLink={admin ? { href: "/admin", label: t.account.adminOpen, hint: t.account.adminOpenHint } : null}
    />
  );
}

function AccountSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {[2, 1, 1, 2].map((rows, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-3.5 w-24 rounded" />
          <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex items-center justify-between border-b border-hairline px-4 py-4 last:border-b-0">
                <div className="skeleton h-4 w-2/5 rounded" />
                <div className="skeleton h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
