"use server";

import { z } from "zod";
import { hasLocale, type Locale } from "@/i18n/config";
import { getAdmin } from "@/lib/admin/auth";
import { checkoutAvailability } from "@/lib/payments/config";
import { CheckoutError, startCheckout } from "@/lib/payments/service";
import { checkLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: "signin" | "consent" | "unavailable" | "tooMany" | "failed" };

const inputSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
  lang: z.custom<Locale>((v) => typeof v === "string" && hasLocale(v)),
});

/**
 * "Pay with card": creates the payment and returns RaiAccept's payment page URL. The price is decided
 * on the server (`plans` table); the browser only says which plan.
 */
export async function beginCheckout(raw: z.input<typeof inputSchema>): Promise<CheckoutResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "failed" };
  const { plan, lang } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "signin" };

  const { data: profile } = await supabase.from("profiles").select("age_confirmed_at").eq("id", auth.user.id).single();
  if (!profile?.age_confirmed_at) return { ok: false, error: "consent" };

  if (checkoutAvailability(!!(await getAdmin())) === "off") return { ok: false, error: "unavailable" };
  if (!(await checkLimit("checkoutUser", auth.user.id))) return { ok: false, error: "tooMany" };

  try {
    const { redirectUrl } = await startCheckout({
      userId: auth.user.id,
      email: auth.user.email,
      plan,
      lang,
      origin: await requestOrigin(),
      ip: await clientIp(),
    });
    return { ok: true, url: redirectUrl };
  } catch (error) {
    console.error("checkout failed", error instanceof CheckoutError || error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}
