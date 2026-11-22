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
npm run db:seed:generate  # rebuild seed.sql (plans only) from src/lib/plans.ts
npm run db:reset          # re-apply all migrations + seed locally
npm run db:import         # copy the starter content (src/content) into the database (needed after a reset)
npm run db:test           # pgTAP: RLS and privilege tests
supabase stop
```

Pushing to the hosted project (when you're ready): `supabase link --project-ref <ref>` then `supabase db push`. Run the seed (plans) once in the SQL editor, or `psql "$DB_URL" -f supabase/seed.sql`, then open **Admin → Import starter content** once.

## Login (Supabase Auth)

- `/[lang]/login` (`?mode=signup` opens the sign-up tab). Everything that needs the email uses a **link** (Supabase's
  built-in emails, no custom SMTP: no codes to type). The link lands on the site and AuthLinkHandler signs the person in;
  a tab still waiting on "check your email" continues by itself when the link is opened in another tab of the same browser.
  - **Sign up** with email + password (8–72 characters, not a common password, not the email; `src/lib/password.ts`),
    then the confirmation link. An existing address gets "already registered" and the sign-in tab.
  - **Sign in** with email + password, or "send me a sign-in link" (passwordless).
  - **Forgot password** = sign in with a link, which opens "Set a new password" on the account page.
  - Unconfirmed accounts get the confirmation link again via `resendConfirmation` (a sign-in link would make Supabase
    drop the password they chose).
  - Google when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
  - Every request needs the Turnstile token (Supabase attack protection) and is rate-limited per IP and per address.
  - Supabase → Authentication → URL Configuration must allow `https://<domain>/**` as a redirect URL, or links fall back
    to the Site URL (still signed in, but "forgot password" won't open the password form).
- Account page → Password: set one (code-only accounts) or change it. "Has a password" is the `password_set` flag in
  user metadata, set by sign-up and by this form (Supabase stores a random hash even for code-only accounts).
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
  restarts from now after a lapse, and writes `audit_log`. Card payments (below) call it through `settle_payment`;
  Admin → Users & Premium can also give Premium by hand.
- **Premium lessons**: `/[lang]/learn/<lesson>` of a Premium unit checks the account on every request and shows
  "this lesson is part of Premium" (with sign-in / pricing links) instead of the lesson. Free lessons stay static and offline.
- **UI hints**: `usePremium()` (`src/lib/billing/use-premium.ts`) unlocks Premium units in the Learn list and shows
  "Premium is active" on the pricing card. It remembers the last answer on the phone (until the period ends) so it works offline,
  and never sends a request for signed-out visitors. It only changes what's shown; access is decided on the server.
- **Before writing Premium lessons**: lesson items are bundled into the browser JavaScript (`src/content/lessons.ts`,
  used by the lesson player and review). Move Premium units' items to the server (pass them as props, and look up
  review words through a server action) so they can't be read from the bundle.
- Tests: `supabase/tests/database/premium.test.sql` (`npm run db:test`).

## Card payments (RaiAccept)

- **Model**: Premium is prepaid (1 month / 1 year) and never renews by itself: RaiAccept has no merchant-initiated
  recurring charges. Paying again while Premium is active adds the time on top. RaiAccept may offer the buyer to save
  the card (one-click checkout, `customerReference` = user id).
- **Flow**: Pricing → `beginCheckout` server action (signed in + consent, rate-limited) → `create_payment` (price from
  `plans`, never from the browser) → RaiAccept "create order" + "create payment session" → full-page redirect to
  `payment.raiaccept.com` → back to `/[lang]/checkout/return?payment=<id>`.
- **Confirmation is never trusted from the browser or the webhook body.** RaiAccept webhooks aren't signed, so
  `/api/payments/raiaccept/webhook?payment=<id>&key=<hmac>` only accepts links we signed and then asks the RaiAccept API
  for the order (`syncPayment`). Order id, reference, amount, currency and `isProduction` must all match before
  `settle_payment` (row lock, idempotent) marks it paid and grants Premium exactly once. A late "failed" never undoes a success.
- The return page, the account page (recent pending payments) and Admin → Payments → "Re-check" all run the same check,
  so a missed webhook never loses a payment.
- **Refunds**: Admin → Payments → Refund (full, to the paying card; type REFUND to confirm), optionally taking back the
  Premium time that payment bought. `claim_refund` makes a double refund impossible.
- **Sandbox vs production**: same URLs, different credentials. `RAIACCEPT_MODE=sandbox` on the live site lets only admins
  open the checkout (test card 4999 9999 9999 0011); everyone else still sees "Premium coming soon".
  Going live: create Production credentials in the Merchant portal, set them + `RAIACCEPT_MODE=production` in Vercel, redeploy.
- Env vars: see `.env.example`. Admin → System check tests the credentials (login only).
- Tests: `supabase/tests/database/payments.test.sql`; locally, `node scripts/raiaccept-mock.mjs` is a stand-in RaiAccept
  (payment page with success / decline / cancel buttons, webhooks with retries, refunds).

## Public pages (bank audit + SEO)

- `/[lang]/about` (landing, Organization + WebApplication JSON-LD), `/[lang]/pricing`, `/[lang]/faq` (FAQPage JSON-LD).
  All static, linked from the footer, in the sitemap.
- Prices live in one place: `PLANS` in `src/lib/plans.ts` (pricing page, FAQ, JSON-LD and the DB seed all read it).
- Company details for the footer and contact page: fill in `src/lib/business.ts` once registered with ARBK
  (name, registration number, fiscal number, address). Until then a "will be published after registration" note shows.

## Slang dictionary (SEO)

- Index: `/tr/argo` and `/sq/zhargon`; one static page per word: `/tr/argo/<slug>`, `/sq/zhargon/<slug>`
  (wrong-language paths and the old `/dictionary` redirect with 308). Each page has its own title/description,
  canonical + hreflang, `DefinedTerm` JSON-LD, and is in the sitemap.
- Content: `src/content/slang.ts` (56 entries in 3 kinds: Kosovan words, Turkish loanwords used in Kosovo,
  Turkish slang → Kosovan). Every entry lists its sources (`src/content/sources.ts`) and has `verified: false`
  until a native Prishtina speaker checks it; the pages say so. Albania/Tirana-only slang (e.g. "lali") is excluded on purpose.
- The same entries feed the translation glossary. Since the admin dashboard, the database is the source of truth: edit words in **Admin → Dictionary** (src/content/slang.ts is only the starter import).
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

## Engagement (preferences sync, Turkish course, reminders, own phrases, invites)

Database: `supabase/migrations/20261125120000_engagement.sql` (tests: `supabase/tests/database/engagement.test.sql`).
Apply it **before** deploying this code: the Learn sync reads the new `user_progress.course` column.

- **Preferences** (dashboard → Tercihler) live on the device and sync to `profiles.preferences`; the newer copy wins, and a device new to the account takes the account's copy.
- **Learn Turkish**: picking "I speak Albanian" (or the SQ | TR switch on /learn) mirrors every lesson so Turkish is the target language. Progress is kept apart: item ids and lesson keys get a `tr:` prefix on the device, `user_progress.course = 'tr'` on the account. The Kosovan-slang track is Albanian-only (`src/lib/learn/course.ts`).
- **Daily reminders** (web push): set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` in Vercel (`npx web-push generate-vapid-keys`). `.github/workflows/reminders.yml` calls `POST /api/cron/reminders` every 15 minutes; add the repository secrets `SITE_URL` and `CRON_SECRET`. A reminder goes out once a day at the chosen local time, only if no lesson was done that day ("your streak ends tonight" when it would break). iPhones need the app on the Home Screen.
- **Own Quick Talk phrases**: up to 50 per person, on the device (IndexedDB) and synced to `custom_phrases`. "Auto-translate" uses the normal translator (counts toward the daily quota).
- **Invites**: `/r/<code>` stores the code in an httpOnly cookie; at the new account's first consent `claim_referral()` gives both people 7 days of Premium (new accounts only, once, at most 10 rewarded invites per person).
- **Weekly summary, streak freeze, sharing**: the dashboard's week card reads the device history; Premium learners can miss one day a week without losing the streak; `/api/share?kind=streak|badge` draws the share picture (font in `assets/fonts`, DM Sans, SIL OFL).

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

## Admin dashboard (`/admin`)

- **Access**: `ADMIN_EMAILS` (server-only env var, comma separated). Sign in on the site with one of those emails (confirmed), then open `/admin`.
  Everyone else gets a 404; signed-out visitors go to the login page. Every admin page and server action checks it again
  (`src/lib/admin/auth.ts`), and every change is written to `audit_log` (Admin → Activity log). On Vercel, set `ADMIN_EMAILS` and redeploy.
- **Content lives in the database now.** Quick Talk (categories, phrases, fill-in options, reply buttons, audio paths), the dictionary
  (+ sources) and lessons (tracks, units free/Premium, lessons, words) are read from Supabase through cached functions
  (`src/lib/content/queries.ts`, `"use cache"` + `cacheTag("content")`). Pages stay prerendered; every admin save calls
  `updateTag("content")`, so the site shows the change on the next request. If the database is empty or unreachable the
  bundled starter content (`src/content/*.ts`) is shown, cached for a few minutes only.
- **Starter content**: `src/content/*.ts` is only the first import (Admin → Import starter content, or `npm run db:import`).
  It adds what's missing and fills empty fields, never overwrites admin edits. Don't edit those files to change the live site.
- **UI text** (Admin → UI text): every string from `messages/tr.json` / `sq.json` can be overridden per language (e.g. `nav.quickTalk`
  = "Bisedë e shpejtë"). Overrides live in `ui_texts` and are laid over the JSON in `getDictionary` (cache tag `ui-text`).
  Placeholders like `{n}` must stay; "Reset to default" removes the override. The JSON files stay the defaults (and the 404 page).
- **Fixed translations** (Admin → Fixed translations): exact texts with your own translation. The Translate action checks them
  before the cache and the AI (`find_fixed_translation`: case, accents, spacing and final punctuation are ignored).
  Approving a "Wrong translation?" report can save one in the same step.
- Also: **Reports** (approve/reject corrections), **Users & Premium** (search by email, give Premium for a period or N days,
  end it; uses `activate_subscription`), **Overview** (users, Premium, translations and AI spend today), **Activity log**.
- Database: `supabase/migrations/20261122120000_admin_cms.sql` (columns, `lesson_items`, `content_sources`, `fixed_translations`,
  `ui_texts`, service-role-only helpers). Tests: `supabase/tests/database/admin_cms.test.sql`.
- Ids that must never change once used: phrase ids (favourites), lesson slugs and word ids (learning progress).

## Before launch

Every Albanian phrase (Admin → Quick Talk) must be checked by native Prishtina speakers, and the legal pages by a lawyer. The emails on the contact/privacy pages are placeholders.
