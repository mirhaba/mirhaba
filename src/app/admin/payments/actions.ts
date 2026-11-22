"use server";

import { adminAction, ok, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";
import { RefundError, refundPayment, syncPayment } from "@/lib/payments/service";

const uuid = (value: string) => {
  if (!/^[0-9a-f-]{36}$/.test(value)) throw new UserError("Unknown payment.");
  return value;
};

/** Ask RaiAccept for the current status and apply it (grants Premium if it was paid and not yet applied). */
export async function recheckPayment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "payment_id");
  return adminAction({ action: "admin.payment.recheck", target: id }, async () => {
    try {
      const result = await syncPayment(uuid(id));
      return ok(result.changed ? `Updated: ${result.status}` : `Checked: still ${result.status}`);
    } catch (error) {
      throw new UserError(`RaiAccept check failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  });
}

/** Full refund through RaiAccept (to the card that paid), optionally taking back the Premium time it bought. */
export async function refund(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "payment_id");
  return adminAction({ action: "admin.payment.refund", target: id }, async () => {
    if (str(form, "confirm") !== "REFUND") throw new UserError('Type REFUND in the box to confirm.');
    try {
      const { refundTransactionId } = await refundPayment(uuid(id), form.get("revoke") === "on");
      return ok(`Refund sent (${refundTransactionId}).`);
    } catch (error) {
      throw new UserError(error instanceof RefundError ? error.message : "Refund failed.");
    }
  });
}
