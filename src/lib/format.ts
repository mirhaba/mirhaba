import { intlLocale, type Locale } from "@/i18n/config";

/** Replace {name} placeholders in a message. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), template);
}

/** Number with the locale's decimal comma ("5,99"), no currency symbol. */
export function amount(value: number, lang: Locale): string {
  return new Intl.NumberFormat(intlLocale[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** JSON for <script type="application/ld+json">, with "<" escaped so it can't close the tag. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
