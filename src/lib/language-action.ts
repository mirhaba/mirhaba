"use server";

import { z } from "zod";
import { hasLocale, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Remember the interface language on the account too (signed in only; does nothing otherwise).
 * The cookie keeps it on this device; the account keeps it for sign-ins on other devices and for
 * the language of emails and reminders. No redirect: the caller is already navigating.
 */
export async function saveLanguage(input: unknown): Promise<void> {
  const lang = z.custom<Locale>((v) => typeof v === "string" && hasLocale(v)).safeParse(input);
  if (!lang.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("profiles").update({ ui_lang: lang.data }).eq("id", data.user.id);
}
