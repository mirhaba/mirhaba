"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Download, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { passwordProblem } from "@/lib/password";
import { Switch } from "@/components/ui/switch";
import { Toast } from "@/components/toast";
import { deleteAccount, setMarketing, setPassword, signOut, type PasswordResult } from "./actions";

type T = Messages["account"];

/** Apple-style inset grouped settings. One accent; destructive actions sit last and ask first. */
export function AccountSettings({
  lang,
  t,
  email,
  marketing,
  activeUntil,
  moderationLink,
  adminLink,
  hasPassword,
  openPassword = false,
  passwordLabels,
}: {
  lang: Locale;
  t: T;
  email: string;
  /** Whether the account can already sign in with a password ("Change" vs "Set"). */
  hasPassword: boolean;
  /** Open the password form right away (after "forgot password"). */
  openPassword?: boolean;
  passwordLabels: { show: string; hide: string };
  marketing: boolean;
  activeUntil: string | null;
  /** Shown to moderators and admins only (role checked on the server). */
  moderationLink: { href: string; label: string; hint: string } | null;
  /** Shown to admins only (ADMIN_EMAILS, checked on the server). A plain <a>: /admin has its own root layout. */
  adminLink?: { href: string; label: string; hint: string } | null;
}) {
  const [toast, setToast] = useState("");
  const [marketingOn, setMarketingOn] = useState(marketing);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<"signOut" | "signOutAll" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (key: typeof busy, action: () => Promise<unknown>) => {
    setBusy(key);
    startTransition(async () => {
      const result = (await action()) as { ok: boolean } | undefined;
      if (result && !result.ok) setToast(t.saveError); // success redirects
      setBusy(null);
    });
  };

  return (
    <div className="fade-in flex flex-col gap-7">
      <Group>
        <Row label={t.email} value={<span className="truncate">{email}</span>} />
        <Row
          label={t.plan}
          value={
            activeUntil ? (
              <span className="flex items-center gap-1.5 font-medium text-accent-text">
                <Crown aria-hidden="true" className="h-4 w-4" />
                {t.premium} · {t.activeUntil.replace("{date}", activeUntil)}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {t.free}
                <Link href={`/${lang}/pricing`} className="font-medium text-accent-text">
                  {t.seePremium}
                </Link>
              </span>
            )
          }
        />
      </Group>

      <PasswordSection
        t={t}
        email={email}
        hasPassword={hasPassword}
        initiallyOpen={openPassword}
        labels={passwordLabels}
        onSaved={() => setToast(t.passwordSaved)}
      />

      <Group>
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3">
          <span>
            <span className="block text-[17px]">{t.marketing}</span>
            <span className="block text-[13px] text-muted">{t.marketingHint}</span>
          </span>
          <Switch
            label={t.marketing}
            checked={marketingOn}
            onChange={(next) => {
              setMarketingOn(next);
              startTransition(async () => {
                const result = await setMarketing(next);
                if (result.ok) setToast(t.saved);
                else {
                  setMarketingOn(!next);
                  setToast(t.saveError);
                }
              });
            }}
          />
        </label>
      </Group>

      {adminLink && (
        <Group>
          <a
            href={adminLink.href}
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-surface-2"
          >
            <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
            <span className="flex-1">
              <span className="block text-[17px]">{adminLink.label}</span>
              <span className="block text-[13px] text-muted">{adminLink.hint}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
          </a>
        </Group>
      )}

      {moderationLink && (
        <Group>
          <Link
            href={moderationLink.href}
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-surface-2"
          >
            <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
            <span className="flex-1">
              <span className="block text-[17px]">{moderationLink.label}</span>
              <span className="block text-[13px] text-muted">{moderationLink.hint}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
          </Link>
        </Group>
      )}

      <Group title={t.yourData}>
        <a
          href="/api/account/export"
          download
          className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-surface-2"
        >
          <Download aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
          <span className="flex-1">
            <span className="block text-[17px]">{t.export}</span>
            <span className="block text-[13px] text-muted">{t.exportHint}</span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
        </a>
      </Group>

      <Group title={t.sessions}>
        <ActionRow
          Icon={LogOut}
          label={t.signOut}
          loading={busy === "signOut"}
          onClick={() => run("signOut", () => signOut({ lang, everywhere: false }))}
        />
        <ActionRow
          Icon={MonitorSmartphone}
          label={t.signOutAll}
          loading={busy === "signOutAll"}
          onClick={() => run("signOutAll", () => signOut({ lang, everywhere: true }))}
        />
      </Group>

      <Group title={t.deleteTitle} footer={t.deleteHint}>
        <ActionRow Icon={Trash2} label={t.deleteButton} onClick={() => setConfirmDelete(true)} />
      </Group>

      {confirmDelete && <DeleteDialog lang={lang} t={t} onClose={() => setConfirmDelete(false)} onError={() => setToast(t.saveError)} />}
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}

function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-1.5 px-4 text-[13px] font-medium text-muted">{title}</h2>}
      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline [&>*+*]:border-t [&>*+*]:border-hairline">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-[13px] text-muted">{footer}</p>}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
      {/* The label never wraps ("E-/posta"); a long value (email) truncates instead. */}
      <span className="shrink-0 text-[17px] whitespace-nowrap">{label}</span>
      <span className="flex min-w-0 justify-end text-right text-[15px] text-muted">{value}</span>
    </div>
  );
}

function ActionRow({
  Icon,
  label,
  onClick,
  loading,
}: {
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-accent-text transition-colors duration-150 active:bg-surface-2 disabled:opacity-60"
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0" />
      {label}
    </button>
  );
}

function DeleteDialog({ lang, t, onClose, onError }: { lang: Locale; t: T; onClose: () => void; onError: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
    cancelRef.current?.focus(); // the safe choice gets focus, never the destructive one
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="delete-title"
      aria-describedby="delete-body"
      className="sheet m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-6 text-foreground shadow-float"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <Trash2 aria-hidden="true" className="h-6 w-6" />
      </div>
      <h2 id="delete-title" className="mt-4 text-[20px] font-semibold">
        {t.deleteConfirmTitle}
      </h2>
      <p id="delete-body" className="mt-1 text-[15px] text-muted">
        {t.deleteConfirmBody} {t.deleteHint}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAccount({ lang });
              if (result && !result.ok) {
                ref.current?.close();
                onError();
              }
            })
          }
        >
          {t.deleteConfirm}
        </Button>
        <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={() => ref.current?.close()}>
          {t.cancel}
        </Button>
      </div>
    </dialog>
  );
}

function PasswordSection({
  t,
  email,
  hasPassword,
  initiallyOpen,
  labels,
  onSaved,
}: {
  t: T;
  email: string;
  hasPassword: boolean;
  initiallyOpen: boolean;
  labels: { show: string; hide: string };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [saved, setSaved] = useState(hasPassword);
  const [value, setValue] = useState("");
  const [error, setError] = useState<Extract<PasswordResult, { ok: false }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();
  const sectionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initiallyOpen) return;
    sectionRef.current?.scrollIntoView({ block: "center" });
    inputRef.current?.focus();
  }, [initiallyOpen]);

  const submit = () => {
    const problem = passwordProblem(value, email);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setPassword(value);
      if (result.ok) {
        setSaved(true);
        setOpen(false);
        setValue("");
        onSaved();
      } else setError(result.error);
    });
  };

  return (
    <div ref={sectionRef}>
      <Group title={t.password}>
        {open ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-3 p-4"
          >
            {/* Lets password managers save the new password for this account. */}
            <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
            <PasswordField
              ref={inputRef}
              id="new-password"
              label={t.newPassword}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="new-password"
              hint={!error ? (saved ? t.passwordHintSet : t.passwordHintNotSet) : undefined}
              error={error ? t.passwordErrors[error] : undefined}
              showLabel={labels.show}
              hideLabel={labels.hide}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={pending} disabled={!value} className="flex-1">
                {t.savePassword}
              </Button>
              <Button
                variant="plain"
                onClick={() => {
                  setOpen(false);
                  setValue("");
                  setError(null);
                }}
                className="text-muted hover:bg-surface-2"
              >
                {t.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-surface-2"
          >
            <KeyRound aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
            <span className="flex-1">
              <span className="block text-[17px]">{saved ? t.passwordChange : t.passwordSet}</span>
              <span className="block text-[13px] text-muted">{saved ? t.passwordHintSet : t.passwordHintNotSet}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
          </button>
        )}
      </Group>
    </div>
  );
}
