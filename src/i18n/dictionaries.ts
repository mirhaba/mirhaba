import "server-only";
import type { Locale } from "./config";
import type tr from "../../messages/tr.json";
import { getUiTextOverrides } from "@/lib/content/queries";
import { applyTextOverrides } from "./text-keys";

export type Messages = typeof tr;

const defaults: Record<Locale, () => Promise<Messages>> = {
  tr: () => import("../../messages/tr.json").then((m) => m.default),
  sq: () => import("../../messages/sq.json").then((m) => m.default),
};

/** The default UI text from messages/<locale>.json, without admin overrides. */
export function getDefaultDictionary(locale: Locale): Promise<Messages> {
  return defaults[locale]();
}

/** UI text for a locale: messages/<locale>.json with the admin's overrides (Admin → UI text) on top. */
export async function getDictionary(locale: Locale): Promise<Messages> {
  const [messages, overrides] = await Promise.all([defaults[locale](), getUiTextOverrides(locale)]);
  return applyTextOverrides(messages, overrides);
}
