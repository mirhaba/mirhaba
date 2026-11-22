// Invite links ("invite a friend, you both get 7 days of Premium"). Shared constants.

/** httpOnly cookie holding the invite code from /r/<code> until the new account's first consent. */
export const REFERRAL_COOKIE = "MIRHABA_REF";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Friends one person can be rewarded for (also enforced in SQL claim_referral). */
export const MAX_REWARDED_INVITES = 10;
export const REFERRAL_DAYS = 7;
