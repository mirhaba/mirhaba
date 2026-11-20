import "server-only";
import type { Locale } from "./config";
import type tr from "../../messages/tr.json";

export type Messages = typeof tr;

const dictionaries: Record<Locale, () => Promise<Messages>> = {
  tr: () => import("../../messages/tr.json").then((m) => m.default),
  sq: () => import("../../messages/sq.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Messages> {
  return dictionaries[locale]();
}
