"use server";

import { getEntitlement } from "./entitlement";

export type PremiumStatus = { signedIn: boolean; premium: boolean; activeUntil: string | null };

/** For the browser: is this visitor Premium? Read-only; access is still checked on every Premium page. */
export async function getPremiumStatus(): Promise<PremiumStatus> {
  return getEntitlement();
}
