/**
 * Password rules, shared by the forms (instant feedback) and the server actions (the real check).
 * 8+ characters, at most 72 (bcrypt ignores the rest), not one of the most common passwords,
 * not the email address. Length beats complexity rules, so there are no "must contain a symbol" rules.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "password123", "qwertyui", "qwerty123",
  "11111111", "00000000", "abcd1234", "iloveyou", "sifre123", "parola123", "fjalekalim", "fjalekalimi",
  "12341234", "87654321", "123123123", "asdfghjk", "galatasaray", "fenerbahce", "besiktas", "kosova123",
  "prishtina", "mirhaba1", "mirhaba123",
]);

export type PasswordProblem = "tooShort" | "tooLong" | "tooCommon" | "sameAsEmail";

export function passwordProblem(password: string, email?: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return "tooShort";
  // Bytes, not characters: "ş" or "ë" take two.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return "tooLong";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "tooCommon";
  if (email && lower === email.trim().toLowerCase()) return "sameAsEmail";
  return null;
}
