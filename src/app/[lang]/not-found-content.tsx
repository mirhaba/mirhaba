"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { StateView } from "@/components/state-view";
import type { Locale } from "@/i18n/config";
import tr from "../../../messages/tr.json";
import sq from "../../../messages/sq.json";

const messages = { tr, sq } as const;

/** 404 in the language of the URL (/sq/... → Albanian first). */
export function LocalizedNotFound() {
  const pathname = usePathname() ?? "";
  return <NotFoundView lang={pathname.startsWith("/sq") ? "sq" : "tr"} />;
}

/** 404 in one language, with one line in the other language underneath. */
export function NotFoundView({ lang }: { lang: Locale }) {
  const other: Locale = lang === "tr" ? "sq" : "tr";
  const t = messages[lang].notFound;
  const o = messages[other].notFound;
  return (
    <>
      <StateView Icon={Compass} title={t.title} body={t.body} action={{ label: t.cta, href: `/${lang}` }} />
      <p lang={other} className="-mt-6 text-center text-[15px] text-muted">
        {o.title}.{" "}
        <Link href={`/${other}`} className="inline-flex min-h-11 items-center font-medium text-accent-text">
          {o.cta}
        </Link>
      </p>
    </>
  );
}
