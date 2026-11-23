# Mirhaba: how to use it (owner's guide)

Plain-English tour of everything the app does, for you as the owner. Developers should read `README.md` instead.
Your users get the same information in Turkish and Albanian at **`/tr/help`** and **`/sq/help`** (footer → "Kullanım kılavuzu").

## What Mirhaba is

A phone-first web app for Turkish people living in Kosovo (and Kosovans learning Turkish). It opens in the browser, can be
added to the home screen like a normal app, and the core part works without internet. The interface is in Turkish (`/tr`)
or Albanian (`/sq`); the **TR | SQ** switch is at the top right.

The first time someone visits, a short tour pops up. It asks "Do you speak Turkish or Albanian?" and shows 6 slides with
mini demos. Anyone can reopen it from the footer ("Nasıl kullanılır?").

## The four main sections (bottom bar on phones)

| Section | What it does | Account? |
| --- | --- | --- |
| **Hızlı Konuş** (Quick Talk), the home page | Ready-made Albanian phrases in 11 categories (greetings, delivery, landlord, work, doctor, bank, municipality, school, shopping, taxi…). Tap one to show it big on screen, read it aloud, or go full screen. Below it are **reply buttons** (Yes / No / Wait / 2nd floor…) the Kosovan taps to answer, and you see the answer in Turkish. Search by typing or by voice. | No |
| **Çeviri** (Translate) | AI translation Turkish ⇄ Albanian, with a "Kosovan" or "Standard" Albanian option. Understands slang and adds "meaning" notes. "Wrong translation?" sends a correction to you. | Yes (free) |
| **Öğren** (Learn) | 5-minute lessons: word cards, multiple choice, matching, sentence building, typing. Daily streak, review of weak words. Switch at the top to learn **Turkish** instead (for Albanian speakers). | No |
| **Argo Sözlük** (Slang dictionary) | Kosovan words, Turkish loanwords, Turkish slang → Kosovan, each on its own page with meaning, example and sources. | No |

Other Quick Talk features: **star** a phrase to pin it at the top (max 6), and **"Kendi cümlelerim"** (my phrases) lets
people save up to 50 of their own phrases, with optional auto-translation.

## The account page (person icon, top right)

Three tabs:

- **Genel bakış (Overview):** streak, lessons done, words learned, daily goal, phrase of the day, this week vs last week,
  6 badges, share a streak/badge picture, and **invite a friend** (both get 7 days of Premium).
- **Tercihler (Preferences):** nickname, which language they're learning, daily goal (1/2/3/5 lessons), speech speed,
  pronunciation hints, light/dark theme, large text, reduced motion, **daily reminder** (a push notification at a chosen
  time if no lesson was done; on iPhone only after adding the app to the home screen). Links to the help page, the tour
  and the FAQ.
- **Hesap (Account):** plan, password, language, marketing emails, download my data, sign out everywhere, delete account.

Sign-up is email + password (with a confirmation link) or Google if you've turned it on. "Forgot password" emails a link.

## Free vs Premium

- Free: Quick Talk, dictionary, the current lessons, **5 translations a day**.
- Premium: €5.99/month or €57.50/year, up to 300 translations a day, and "streak freeze" (missing one day a week doesn't
  break the streak). Prices live in `src/lib/plans.ts`.
- **No auto-renewal.** People pay once by card on Raiffeisen's RaiAccept page; paying again adds time. While
  `RAIACCEPT_MODE=sandbox`, only admins can check out and everyone else sees "Premium coming soon".

## What works offline

After one visit with internet: Quick Talk (including pinned and own phrases), lesson progress, and pages already opened.
Translation, sign-in and payment need internet. Progress syncs to the account when the connection comes back.

## Your admin dashboard (`/admin`)

Only emails listed in the `ADMIN_EMAILS` environment variable can open it (everyone else gets a 404). Sign in on the site
with that email, then go to `/admin` or Account → "Yönetim paneli". What you can do there:

| Page | Use it to |
| --- | --- |
| **Overview** | See users, Premium count, translations and AI cost today. |
| **Quick Talk** | Edit categories, phrases, fill-in options and reply buttons. |
| **Dictionary** (+ Sources) | Add/edit slang words; mark them verified once a native speaker checked them. |
| **Lessons** | Edit tracks, units (free or Premium), lessons and words. |
| **UI text** | Change any text on the site in either language without code, **including the whole help page** (keys starting with `help.`). |
| **Fixed translations** | Force your own translation for a specific sentence. |
| **Reports** | Approve/reject "Wrong translation?" reports (approving can create a fixed translation). |
| **Users & Premium** | Find a user by email, give or end Premium by hand. |
| **Payments** | See payments, re-check a stuck one, refund. |
| **Import starter content** | One-time copy of the bundled content into the database (after a fresh database). |
| **System check** | Shows which environment variables / services are set up correctly. |
| **Activity log** | Every admin change, who and when. |

## Good to know before launch

- All Albanian content must be checked by native Prishtina speakers; dictionary words show "not checked yet" until marked verified.
- Legal pages are drafts; company details (`src/lib/business.ts`) and contact emails are placeholders.
- Reminders need the VAPID keys and the GitHub Actions cron secrets (see README → Engagement).
