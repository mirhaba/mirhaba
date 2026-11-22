"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { safeNextPath } from "@/lib/safe-redirect";
import { passwordProblem } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { GoogleMark } from "@/components/google-mark";
import { Toast } from "@/components/toast";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { resendConfirmation, sendCode, signInWithPassword, signUp, type AuthError } from "./actions";

const RESEND_SECONDS = 60;
const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

type T = Messages["auth"];
type Mode = "signin" | "signup";
/** Sign in with a password, or with a link sent by email (also the "forgot password" path). */
type Method = "password" | "link";
type Problem = AuthError | "oauth" | "link";

const PASSWORD_ERRORS = new Set<Problem>(["wrongPassword", "tooShort", "tooLong", "tooCommon", "sameAsEmail"]);
const signedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);

export function LoginForm({ lang, t }: { lang: Locale; t: T }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), lang);

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<"form" | "sent">("form");
  /** What the email link does: sign in, or confirm a new account. */
  const [purpose, setPurpose] = useState<"signin" | "signup">("signin");
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const initialError = params.get("error");
  const [error, setError] = useState<Problem | null>(initialError === "oauth" || initialError === "link" ? initialError : null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  // Where the email link should land: "forgot password" opens "set a new password" on the account page.
  const linkNext = forgot ? `/${lang}/app?password=1` : next;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // While waiting for the email: if the link is opened in another tab of this browser, the session cookie
  // appears here too (the readable signed-in hint), so this tab moves on by itself.
  useEffect(() => {
    if (step !== "sent") return;
    const check = () => {
      if (signedIn()) window.location.replace(linkNext);
    };
    const timer = setInterval(check, 2000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [step, linkNext]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setMethod("password");
    setForgot(false);
    setError(null);
  };

  /**
   * Email a link: a sign-in link (passwordless, "forgot password"), or, for a new account, its
   * confirmation link again (resendConfirmation keeps the chosen password; a sign-in link would make
   * Supabase drop an unconfirmed account's password).
   */
  const requestLink = (isResend: boolean, linkPurpose: "signin" | "signup" = purpose) => {
    setError(null);
    startTransition(async () => {
      const send = linkPurpose === "signup" ? resendConfirmation : sendCode;
      const result = await send({ lang, email, captchaToken, next: linkNext });
      turnstile.current?.reset(); // tokens are single-use
      if (!result.ok) {
        setError(result.error);
        if (!isResend) emailInput.current?.focus(); // back to the field so the fix is one tap away
        return;
      }
      setCooldown(RESEND_SECONDS);
      setPurpose(linkPurpose);
      if (isResend) setToast(t.codeResent);
      else setStep("sent");
    });
  };

  const submitPassword = () => {
    setError(null);
    startTransition(async () => {
      const result = await signInWithPassword({ lang, email, password, captchaToken, next });
      turnstile.current?.reset();
      if (result && !result.ok) {
        setError(result.error); // on success the server redirects
        if (result.error === "wrongPassword") passwordInput.current?.select();
      }
    });
  };

  const submitSignUp = () => {
    const problem = passwordProblem(password, email);
    if (problem) {
      setError(problem);
      passwordInput.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await signUp({ lang, email, password, captchaToken, next });
      turnstile.current?.reset();
      if (!result) return; // signed in directly (server redirected)
      if (!result.ok) {
        if (result.error === "exists") {
          // Already registered: continue on the sign-in tab with the same email.
          setMode("signin");
          setPassword("");
        }
        setError(result.error);
        return;
      }
      setPurpose("signup");
      setCooldown(RESEND_SECONDS);
      setStep("sent");
    });
  };

  const signInWithGoogle = async () => {
    setError(null);
    setGooglePending(true);
    const redirectTo = `${location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (oauthError) {
      setGooglePending(false);
      setError("oauth");
    }
  };

  const message = (e: Problem | null) => (e ? t.errors[e] : undefined);
  const emailError = step === "form" && error === "invalidEmail" ? message(error) : undefined;
  const passwordError = step === "form" && error && PASSWORD_ERRORS.has(error) ? message(error) : undefined;
  const formError = error && !emailError && !passwordError ? message(error) : undefined;

  // ---------- Step 2: check your email ----------
  if (step === "sent") {
    return (
      <div key="sent" className="fade-in flex flex-col gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
          <MailCheck aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[28px] leading-tight font-bold">{purpose === "signup" ? t.verifyTitle : t.codeTitle}</h1>
          <p className="mt-2 text-[17px]">{(purpose === "signup" ? t.verifySentTo : t.codeSentTo).replace("{email}", email)}</p>
          <p className="mt-2 text-[15px] text-muted">{t.spamHint}</p>
        </div>
        {formError && <FormError message={formError} />}
        {/* A fresh bot-check token for "Resend" (the one from the first step was used up). */}
        <Turnstile ref={turnstile} lang={lang} onToken={setCaptchaToken} />
        <div className="flex flex-col items-center gap-1">
          {cooldown > 0 ? (
            <p className="flex h-11 items-center text-[15px] text-muted" aria-live="polite">
              {t.resendIn.replace("{s}", String(cooldown))}
            </p>
          ) : (
            <Button variant="plain" onClick={() => requestLink(true)} disabled={pending} loading={pending}>
              {t.resend}
            </Button>
          )}
          <Button
            variant="plain"
            onClick={() => {
              setStep("form");
              setError(null);
            }}
            className="text-muted hover:bg-surface-2"
          >
            {t.changeEmail}
          </Button>
        </div>
        <Toast message={toast} onDone={() => setToast("")} />
      </div>
    );
  }

  // ---------- Step 1: sign in / sign up ----------
  const usingLink = mode === "signin" && method === "link";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{mode === "signup" ? t.signUpTitle : t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{mode === "signup" ? t.signUpSubtitle : t.subtitle}</p>
      </div>

      <div role="radiogroup" aria-label={t.modeLabel} className="flex rounded-xl bg-surface-2 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => mode !== m && switchMode(m)}
            className={`pressable h-10 flex-1 rounded-lg text-[15px] font-semibold ${mode === m ? "bg-surface text-foreground shadow-card" : "text-muted"}`}
          >
            {m === "signin" ? t.signInTab : t.signUpTab}
          </button>
        ))}
      </div>

      <div key={`${mode}-${method}`} className="fade-in flex flex-col gap-5">
        {googleEnabled && !usingLink && (
          <>
            <Button variant="secondary" onClick={signInWithGoogle} loading={googlePending}>
              {!googlePending && <GoogleMark className="h-5 w-5" />}
              {t.google}
            </Button>
            <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-hairline" />
              {t.or}
              <span className="h-px flex-1 bg-hairline" />
            </div>
          </>
        )}

        {usingLink && forgot && <p className="rounded-xl bg-surface-2 px-4 py-3 text-[15px] text-muted">{t.forgotHint}</p>}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (usingLink) requestLink(false, "signin");
            else if (mode === "signup") submitSignUp();
            else submitPassword();
          }}
          className="flex flex-col gap-4"
        >
          <Field
            ref={emailInput}
            id="email"
            type="email"
            label={t.emailLabel}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            autoComplete={mode === "signup" ? "email" : "username"}
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint={usingLink ? "send" : "next"}
            required
            error={emailError || undefined}
          />
          {!usingLink && (
            <PasswordField
              ref={passwordInput}
              id="password"
              label={t.passwordLabel}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              enterKeyHint="go"
              required
              minLength={mode === "signup" ? 8 : undefined}
              hint={mode === "signup" ? t.passwordHint : undefined}
              error={passwordError}
              showLabel={t.showPassword}
              hideLabel={t.hidePassword}
            />
          )}
          <Turnstile ref={turnstile} lang={lang} onToken={setCaptchaToken} />
          {formError && <FormError message={formError} />}
          {error === "unconfirmed" && (
            <Button variant="secondary" onClick={() => requestLink(false, "signup")} disabled={pending}>
              {t.sendVerification}
            </Button>
          )}
          <Button type="submit" loading={pending} disabled={!email.trim() || (!usingLink && !password)}>
            {usingLink ? (pending ? t.sending : t.sendCode) : mode === "signup" ? (pending ? t.creating : t.createAccount) : pending ? t.signingIn : t.signIn}
          </Button>
        </form>

        {mode === "signin" && (
          <div className="flex flex-col items-center gap-1">
            {usingLink ? (
              <Button
                variant="plain"
                onClick={() => {
                  setMethod("password");
                  setForgot(false);
                  setError(null);
                }}
              >
                {t.usePassword}
              </Button>
            ) : (
              <>
                <Button
                  variant="plain"
                  onClick={() => {
                    setMethod("link");
                    setForgot(true);
                    setError(null);
                  }}
                >
                  {t.forgot}
                </Button>
                <Button
                  variant="plain"
                  className="text-muted hover:bg-surface-2"
                  onClick={() => {
                    setMethod("link");
                    setForgot(false);
                    setError(null);
                  }}
                >
                  {t.useCode}
                </Button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-[15px] text-muted">
          {mode === "signin" ? t.noAccount : t.haveAccount}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="inline-flex min-h-11 items-center px-1 font-semibold text-accent-text"
          >
            {mode === "signin" ? t.signUpTab : t.signInTab}
          </button>
        </p>
      </div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="fade-in rounded-xl bg-accent-soft px-4 py-3 text-[15px] font-medium text-accent-text">
      {message}
    </p>
  );
}
