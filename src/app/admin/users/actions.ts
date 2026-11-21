"use server";

import { adminAction, check, int, ok, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

const uuid = (value: string) => {
  if (!/^[0-9a-f-]{36}$/.test(value)) throw new UserError("Unknown user.");
  return value;
};

/** Give Premium: one billing period of the plan, or a number of free days. Extends an active one. */
export async function grantPremium(_: ActionResult, form: FormData): Promise<ActionResult> {
  const userId = str(form, "user_id");
  return adminAction({ action: "admin.premium.grant", target: userId }, async ({ db }) => {
    const plan = str(form, "plan");
    if (!["monthly", "yearly"].includes(plan)) throw new UserError("Pick a plan.");
    const days = str(form, "length") === "days" ? int(form, "days") : null;
    if (days !== null && (days < 1 || days > 3660)) throw new UserError("Days must be between 1 and 3660.");
    const until = check(await db.rpc("activate_subscription", { uid: uuid(userId), plan, ref: null, days })) as unknown as string;
    return ok(`Premium until ${new Date(until).toLocaleDateString("en-GB", { dateStyle: "long" })}`);
  });
}

/** End Premium now (e.g. refund or mistake). Payments, once live, are refunded separately at the bank. */
export async function endPremium(_: ActionResult, form: FormData): Promise<ActionResult> {
  const userId = str(form, "user_id");
  return adminAction({ action: "admin.premium.end", target: userId }, async ({ db }) => {
    check(
      await db
        .from("subscriptions")
        .update({ status: "canceled", current_period_end: new Date().toISOString(), cancel_at_period_end: false })
        .eq("user_id", uuid(userId))
        .eq("status", "active"),
    );
    return ok("Premium ended");
  });
}
