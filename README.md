# Mirhaba App

Turkish ↔ Kosovan Albanian for everyone from Turkey living in Kosovo. PWA, Turkish-first UI (Albanian as the second language), Quick Talk works offline.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /tr
npm run build && npm run start   # production build (service worker only registers here)
```

## What's built (Phase 1: foundation + Quick Talk)

| Area | Where |
| --- | --- |
| TR/SQ routing (`/tr`, `/sq`, cookie + Accept-Language redirect) | `src/proxy.ts`, `src/i18n/` |
| UI text (never hard-coded) | `messages/tr.json`, `messages/sq.json` |
| Quick Talk: 11 categories, fill-in slots, reply board, search, 6 favourites | `src/components/quick-talk/`, `src/content/quick-talk.ts` |
| Turkish-letter reading hint for Albanian ("Jam te dera" → "yam te dera") | `src/lib/text.ts` |
| Favourites stored on the phone (IndexedDB via Dexie), synced to the account when signed in | `src/lib/offline-db.ts`, `src/lib/favorites/` |
| Offline: hand-written service worker, offline screen | `public/sw.js`, `src/app/[lang]/offline` |
| PWA manifest + generated icons | `src/app/manifest.ts`, `src/app/icons/*`, `src/app/apple-icon.tsx` |
| Security headers (CSP, HSTS, frame, permissions) | `next.config.ts` |
| SEO: metadata, hreflang, robots, sitemap | `src/app/[lang]/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` |
| Draft legal pages (privacy, terms, refunds, cookies, contact) | `src/app/[lang]/legal/[page]` |

Notes:
- Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before changing routing/caching (see `AGENTS.md`).
- i18n uses Next's native dictionary pattern instead of `next-intl` (one less dependency, no compatibility risk with Next 16). Same `messages/*.json` files, so switching later is easy.
- Bump `VERSION` in `public/sw.js` when the caching rules change.

## Brand assets

- Sources (final geometry, never redraw): `public/brand/mirhaba-mark.svg`, `mirhaba-mark-on-dark.svg`, `app-icon.svg`, `app-icon-maskable.svg`, and the favicon `src/app/icon.svg`.
- `<Logo />` / `<LogoMark />` in `src/components/brand/Logo.tsx` (variants `light`, `dark`, and `auto`, which follows the theme; sizes `sm`/`md`/`lg`).
- `npm run icons` regenerates favicon.ico, apple-icon.png, the PWA icons, the email logo PNG and the Open Graph image (DM Sans via Satori, rasterised by sharp).
- Brand colours are CSS variables and Tailwind tokens: `brand-red`, `brand-ink`, `brand-gold`, `brand-paper`, `brand-mist`, `brand-body`. The single UI accent is `brand-red`.
- The Open Graph image lives in `src/app/[lang]/` because the `[lang]` layout sets openGraph metadata, which would hide an app-root image.

## Design rules

- One accent colour (`--accent` = brand red `#C1272D`). No gradients. Font: DM Sans (400/700).
- Glass (blur + translucency) only on chrome that floats over content: header, tab bar, toast, install hint.
- One icon set: Lucide (`lucide-react`). No emoji in the UI. Category icons are keys in `src/components/icons.tsx`.
- Motion is 150–300 ms and functional only: `.pressable` (press state), `.fade-in` (lists/screens, staggered by `--i`), `.sheet` (dialog). All disabled under `prefers-reduced-motion`.
- Every data screen has a skeleton (`loading.tsx` or inline), an empty state and an error state (`StateView`).
- Visible labels on inputs; placeholders are only examples.

## Database (Supabase)

Migrations live in `supabase/migrations/`, the seed in `supabase/seed.sql`, RLS tests in `supabase/tests/`.

```bash
supabase start            # local stack in Docker (ports 54421–54429, see supabase/config.toml)
npm run db:seed:generate  # rebuild seed.sql from src/content/quick-talk.ts
npm run db:reset          # re-apply all migrations + seed locally
npm run db:test           # pgTAP: RLS and privilege tests
supabase stop
```

Pushing to the hosted project (when you're ready): `supabase link --project-ref <ref>` then `supabase db push`. Run the seed once in the SQL editor, or `psql "$DB_URL" -f supabase/seed.sql`.

## Login (Supabase Auth)

- `/[lang]/login`: email → 6-digit code (no magic links), or Google when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
- `/[lang]/app` is the account page and is protected by `src/proxy.ts`. Only `/app` and `/login` touch auth, so Quick Talk never waits on it.
- Session cookies are forced httpOnly + SameSite=Lax (+ Secure in production) in `src/lib/supabase/cookies.ts`.
- First sign-in shows a one-time consent (16+, terms, privacy; marketing optional), stored in `consents`.
- Account: language (saved to profile), marketing opt-in, export my data (`/api/account/export`), sign out / sign out everywhere, delete account.
- Locally, emails go to Mailpit: http://127.0.0.1:54424. The email template is `supabase/templates/login-code.html`.

Hosted setup when you go live (Supabase dashboard):
1. Authentication → Email Templates: paste `login-code.html` into **Magic Link** and **Confirm signup**.
2. Authentication → SMTP: use Resend so codes come from your domain.
3. Authentication → Attack Protection: enable Turnstile with `TURNSTILE_SECRET_KEY`.
4. Authentication → Providers → Google: add the client id/secret, then set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
5. Authentication → URL Configuration: site URL + `https://<domain>/api/auth/callback`.

## Quick Talk favourites sync

- Up to 6 pinned phrases live on the phone (Dexie v3 `favorites`: `phraseId`, `updatedAt`, `deleted`) and work offline with no account.
- Signed in: Quick Talk merges them with the account when it opens (1.5 s after the first screen, when the browser is idle; the sync code is lazy-loaded) and after every pin/unpin. Taps during a running sync are folded into one extra round.
- **Merge rule: one entry per phrase with a timestamp and a tombstone** (`deleted`). Per phrase the newer change wins; at the same time the unpin wins. Then the 6 most recently pinned stay; older pins become tombstones. Order = pin order.
  Why not last-writer-wins on the whole list: two phones that each changed a *different* phrase would lose one change, and the first sync of a phone used before signing in would wipe either its pins or the account's. Per-phrase entries merge both; tombstones stop an unpin from coming back. Tombstones are bounded by the number of phrases, so they are never pruned (pruning would let an old offline phone resurrect them).
- Postgres does the merge atomically: `sync_favorites(jsonb)` (security invoker, own rows via RLS, per-user advisory lock, future timestamps clamped to now). The phone applies the same rules to the reply (`src/lib/favorites/merge.ts`) so a pin made during the request is kept. A deferred constraint trigger refuses more than 6 pinned rows even for direct table writes.
- Local phrase ids map to `phrases.slug` as `qt-<id>`; phrases missing from the database stay on the phone only.
- Signed-out visitors never send a request: the server writes a readable `MIRHABA_SIGNED_IN=1` hint next to the httpOnly session cookies (`src/lib/supabase/cookies.ts`) and clears it on sign-out; the phone also clears it if the server says the session is gone. The hint only decides whether to try; access is always checked on the server.
- Export lists `favorites` (by phrase, in order) and `favorites_removed`; account deletion removes them.

## Learn Albanian

- `/[lang]/learn`: tracks → units → lessons from `src/content/lessons.ts` (3 tracks, 9 lessons, ~65 words/phrases;
  **needs native-speaker review**). To add a lesson, add its items: exercises are generated.
- Engine (`src/lib/learn/engine.ts`): learn cards in groups of 3, multiple choice, pair matching, word order,
  typing (ë/ç buttons; missing accents count as right but the spelling is shown). Wrong answers return once at the end.
  Score = first-try correct. Deterministic per seed.
- Progress lives on the device (IndexedDB v2 tables `lessonProgress`, `itemStats`, `meta`): best score per lesson,
  daily streak, and spaced repetition for weak words (`/[lang]/learn/review`). Works offline, no account needed.
- **Account sync** (signed-in users): opening Learn and finishing a session merge the phone's progress with the account
  in one request (`src/lib/learn/sync-action.ts`, pure rules in `src/lib/learn/merge.ts`): best score per lesson wins,
  the most recently practised word state wins, the later streak wins (longest = max). Symmetric and idempotent, so
  syncing twice or from several phones is safe. Tables `user_progress`, `user_item_stats`, `user_learning` (own rows only,
  included in data export, deleted with the account). Signed out or offline: progress just stays on the phone.
- `isFree` on units: units with `isFree: false` are Premium (see below). All current units are free.

## Premium

- **One source of truth**: a row in `subscriptions` with `status = 'active'` and `current_period_end` in the future.
  Server code asks `getEntitlement()` (`src/lib/billing/entitlement.ts`, cached per request); SQL asks `has_active_subscription()`.
  Translation limits, the account page and Premium lessons all read it from there.
- **Turning Premium on**: only the SQL function `activate_subscription(uid, plan, ref, days)` (service role / SQL editor; users can't call it).
  It reuses the user's row, adds one billing period (or `days`), extends from the current end when renewing early,
  restarts from now after a lapse, and writes `audit_log`. The RaiAccept webhook will call it after a verified payment.
  Until then, grant Premium by hand in the SQL editor:
  `select activate_subscription('<user id>', 'monthly');` or `select activate_subscription('<user id>', 'yearly', null, 30);` (30 free days).
- **Premium lessons**: `/[lang]/learn/<lesson>` of a Premium unit checks the account on every request and shows
  "this lesson is part of Premium" (with sign-in / pricing links) instead of the lesson. Free lessons stay static and offline.
- **UI hints**: `usePremium()` (`src/lib/billing/use-premium.ts`) unlocks Premium units in the Learn list and shows
  "Premium is active" on the pricing card. It remembers the last answer on the phone (until the period ends) so it works offline,
  and never sends a request for signed-out visitors. It only changes what's shown; access is decided on the server.
- **Before writing Premium lessons**: lesson items are bundled into the browser JavaScript (`src/content/lessons.ts`,
  used by the lesson player and review). Move Premium units' items to the server (pass them as props, and look up
  review words through a server action) so they can't be read from the bundle.
- Tests: `supabase/tests/database/premium.test.sql` (`npm run db:test`).

## Public pages (bank audit + SEO)

- `/[lang]/about` (landing, Organization + WebApplication JSON-LD), `/[lang]/pricing`, `/[lang]/faq` (FAQPage JSON-LD).
  All static, linked from the footer, in the sitemap.
- Prices live in one place: `PLANS` in `src/lib/plans.ts` (pricing page, FAQ, JSON-LD and the DB seed all read it).
- Company details for the footer and contact page: fill in `src/lib/business.ts` once registered with ARBK
  (name, registration number, fiscal number, address). Until then a "will be published after registration" note shows.
- Premium checkout shows "coming soon" until RaiAccept is live.

## Slang dictionary (SEO)

- Index: `/tr/argo` and `/sq/zhargon`; one static page per word: `/tr/argo/<slug>`, `/sq/zhargon/<slug>`
  (wrong-language paths and the old `/dictionary` redirect with 308). Each page has its own title/description,
  canonical + hreflang, `DefinedTerm` JSON-LD, and is in the sitemap.
- Content: `src/content/slang.ts` (56 entries in 3 kinds: Kosovan words, Turkish loanwords used in Kosovo,
  Turkish slang → Kosovan). Every entry lists its sources (`src/content/sources.ts`) and has `verified: false`
  until a native Prishtina speaker checks it; the pages say so. Albania/Tirana-only slang (e.g. "lali") is excluded on purpose.
- The same entries feed the translation glossary and the DB seed (`npm run db:seed:generate`, then `npm run db:reset`).
- To mark a word as checked: set `verified: true` on it (the page then shows "checked by a native speaker").

## Text translation

- Page: `/[lang]/translate`. Directions TR → SQ (Kosovan or standard) and SQ → TR. Needs an account (consent given).
- Engine: OpenAI's open-weight `gpt-oss-120b` on Groq (OpenAI-compatible API, reasoning effort `low`, strict JSON-schema output, one retry on 429/5xx) in `src/lib/translate/translator.ts`. Override the model with `TRANSLATION_MODEL`. The user's text is wrapped as data, never as instructions.
- Slang: `src/content/slang.ts` (starter glossary, **needs native-speaker review**). Matching entries are injected into the prompt and become the "meaning" notes.
- Limits (`src/lib/plans.ts`): free 5/day, paid 300/day (fair use), counted atomically in Postgres; failed AI calls are refunded.
- Global AI spending cap: `AI_DAILY_SPEND_CAP_EUR` (default 5). Over the cap, translation pauses ("busy") instead of billing more.
- Cache: identical requests reuse the answer for 30 days. Only a hash of the input is stored, never the input or who sent it. Run `select prune_translation_cache()` daily once live.
- "Wrong translation?" saves a correction to the moderation queue (`corrections`, pending).
- Local dev without a key: `TRANSLATION_MOCK=1` returns `[mock]` translations (ignored on Vercel production). With a key: set `GROQ_API_KEY` and remove `TRANSLATION_MOCK`.

## Launch essentials

**Rate limits** (`src/lib/rate-limit.ts`, Upstash Redis, sliding window). All limits are in one `RULES` table:
login code requests (5 per IP / 3 per email per 10 min), code checks (10 per IP / 6 per email per 10 min),
translation bursts (12 per user / 30 per IP per minute), corrections (10 per user per hour),
cookie choices (20 per IP per minute), data export (5 per user per hour), Learn and favourites sync (30 per user per minute each).
Keys are hashed, so Redis never stores an IP, email or user id. Without Upstash env vars it uses an
in-memory limiter in development and skips limits on Vercel (logged), so a missing variable never locks people out.
Setup: create a Redis database at console.upstash.com (region: Frankfurt, eu-central-1), copy the REST URL + token.

**Error tracking** (Sentry, `src/instrumentation*.ts`, `src/lib/sentry-options.ts`). Off until `NEXT_PUBLIC_SENTRY_DSN` is set.
No IPs, cookies, headers, request bodies or query strings are sent; no session replay. Reports go through `/monitoring`.
In the browser Sentry is lazy-loaded after the page is idle (and not at all without a DSN), so it never slows Quick Talk; browser performance tracing is off, server tracing samples 10%.
Setup: create a Next.js project on sentry.io with **EU data region**; in Project Settings → Security & Privacy turn on
"Prevent storing of IP addresses"; set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` in Vercel for readable stack traces.
Alerts to your phone: install the Sentry app and create an alert rule ("a new issue is created" → notify you).

**Login emails via Resend** (Supabase dashboard, nothing in code):
1. resend.com → Domains → add `mirhaba.app` (or your domain) and add the SPF + DKIM DNS records it shows; wait for "Verified".
2. Supabase → Authentication → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key,
   sender `Mirhaba <giris@your-domain>`.
3. Supabase → Authentication → Rate Limits: raise "emails per hour" (custom SMTP starts at 30/hour).

**Moderation**: `/[lang]/app/moderation` lists "Wrong translation?" reports (pending / approved / rejected).
Only `moderator` and `admin` roles can see or change them (RLS); each review is written to `audit_log`.
Make someone a moderator in the SQL editor: `update profiles set role = 'moderator' where id = '<user id>';`

## Deploy to Vercel

Hosting is Vercel. (Turnstile, the bot check, is a Cloudflare widget, not Cloudflare hosting.)

1. Import the GitHub repo in Vercel. Framework: Next.js. No build settings to change.
2. Environment variables (Production + Preview), from `.env.example`. Minimum to run:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (hosted project)
   - `GROQ_API_KEY` (translation) and `AI_DAILY_SPEND_CAP_EUR`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limits) and `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`)
   - Optional now: `NEXT_PUBLIC_POSTHOG_KEY`, Turnstile keys, `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`
   - `NEXT_PUBLIC_SITE_URL` only once you have your own domain (otherwise Vercel's URL is used).
   - `NEXT_PUBLIC_*` values are baked in at build time (also into the CSP), so redeploy after changing them.
3. Supabase → Authentication → URL Configuration:
   - Site URL: your production URL.
   - Redirect URLs: `https://<prod-domain>/api/auth/callback` and, for previews, `https://*-<your-team>.vercel.app/**`.
4. Push migrations and seed to the hosted DB (see Database), and paste the email template (see Login).
5. Preview deployments are automatically `noindex` (robots.txt disallows everything outside production).

## Before launch

Every Albanian phrase in `src/content/quick-talk.ts` must be checked by native Prishtina speakers, and the legal pages by a lawyer. The emails on the contact/privacy pages are placeholders.
