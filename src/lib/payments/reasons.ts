/**
 * RaiAccept 4-digit result codes (docs → "Transaction responses and error codes") grouped into the
 * few reasons a buyer can act on. Unknown codes fall back to the generic message.
 */
export type DeclineReason = "insufficient" | "declined" | "card" | "cvv" | "threeDs" | "technical";

export function declineReason(code: string | null | undefined): DeclineReason | null {
  if (!code || !/^\d{4}$/.test(code) || code === "0000") return null;
  const n = Number(code);
  if (n === 2004) return "insufficient";
  if (n === 3005 || n === 3017) return "cvv";
  if ([1005, 1006, 2001, 3002, 3003, 3004, 3015, 3016, 7009].includes(n)) return "card";
  if ((n >= 2006 && n <= 2021) || [3001, 3008, 3013, 3014, 7008].includes(n)) return "threeDs";
  if ([3006, 3007, 5001, 9999].includes(n) || (n >= 6001 && n <= 6009) || (n >= 7001 && n <= 7011)) return "technical";
  return "declined";
}
