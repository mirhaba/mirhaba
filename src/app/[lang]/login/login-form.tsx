"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { GoogleMark } from "@/components/google-mark";
import { Toast } from "@/components/toast";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { sendCode, verifyCode, type AuthError } from "./actions";

const RESEND_SECONDS = 60;
const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

type T = Messages["auth"];

export function LoginForm({ lang, t }: { lang: Locale; t: T }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), lang);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthError | "oauth" | null>(params.get("error") === "oauth" ? "oauth" : null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  const requestCode = (isResend: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await sendCode({ lang, email, captchaToken });
      turnstile.current?.reset(); // tokens are single-use
      if (!result.ok) {
        setError(result.error);
        if (!isResend) emailInput.current?.focus(); // back to the field so the fix is one tap away
        return;
      }
      setCooldown(RESEND_SECONDS);
      if (isResend) setToast(t.codeResent);
      else setStep("code");
    });
  };

  const submitCode = (value: string) => {
    setError(null);
    startTransition(async () => {
      const result = await verifyCode({ lang, email, code: value, next });
      if (result && !result.ok) {
        setError(result.error); // on success the server redirects
        codeInput.current?.select(); // retyping replaces the wrong code
      }
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

  const message = (e: AuthError | "oauth" | null) => (e ? t.errors[e] : undefined);
  const emailError = step === "email" && (error === "invalidEmail" ? message(error) : undefined);
  const codeError = step === "code" && (error === "invalidCode" || error === "wrongCode") ? message(error) : undefined;
  const formError = error && !emailError && !codeError ? message(error) : undefined;

  if (step === "code") {
    return (
      <div key="code" className="fade-in flex flex-col gap-5">
        <div>
          <h2 className="text-[22px] font-semibold">{t.codeTitle}</h2>
          <p className="mt-1 text-[15px] text-muted">{t.codeSentTo.replace("{email}", email)}</p>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitCode(code);
          }}
          className="flex flex-col gap-4"
        >
          <Field
            ref={codeInput}
            id="code"
            label={t.codeLabel}
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(value);
              if (value.length === 6 && !pending) submitCode(value); // auto-submit, also for SMS-style autofill
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            className="text-center text-[24px] font-semibold tracking-[0.3em]"
            error={codeError}
          />
          {formError && <FormError message={formError} />}
          <Button type="submit" loading={pending} disabled={code.length !== 6}>
            {pending ? t.verifying : t.verify}
          </Button>
        </form>
        <div className="flex flex-col items-center gap-1">
          {cooldown > 0 ? (
            <p className="flex h-11 items-center text-[15px] text-muted" aria-live="polite">
              {t.resendIn.replace("{s}", String(cooldown))}
            </p>
          ) : (
            <Button variant="plain" onClick={() => requestCode(true)} disabled={pending}>
              {t.resend}
            </Button>
          )}
          <Button
            variant="plain"
            onClick={() => {
              setStep("email");
              setCode("");
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

  return (
    <div key="email" className="fade-in flex flex-col gap-5">
      {googleEnabled && (
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
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          requestCode(false);
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
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          required
          error={emailError || undefined}
        />
        <Turnstile ref={turnstile} lang={lang} onToken={setCaptchaToken} />
        {formError && <FormError message={formError} />}
        <Button type="submit" loading={pending} disabled={!email.trim()}>
          {pending ? t.sending : t.sendCode}
        </Button>
      </form>
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
