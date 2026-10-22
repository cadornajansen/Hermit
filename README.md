# HERMIT

**Your business, remembered.** A compliance home base for Philippine MSME owners: one checklist of the permits,
registrations and tax filings a business needs, what's done, what's due, and an assistant that pre-fills the forms.

This is the early-phase build of the PRD MVP: a Next.js app on Vercel with a Supabase backend, and **Kuya Hermit**, an
AI assistant (AssemblyAI LLM Gateway) with guardrails, Filipino/English, and form pre-fill. Every eGov API is wired behind
an adapter and runs on a mock until its credentials are set, then switches to the real
[egov.js](https://github.com/omsimos/egov.js) client on its own.

```bash
pnpm install
npx vercel link && npx vercel env pull   # Supabase + Kuya Hermit keys into .env.local
pnpm dev     # http://localhost:3000
pnpm test    # engine, calendar, vault and forms checks
```

Without `.env.local` the app still runs: device-only storage and keyword answers instead of Kuya Hermit.

## Backend (Supabase)

`supabase/migrations/` holds the schema: `owners` (profile + checklist), `documents`, append-only `vault_events`,
`chat_messages`, and a private `documents` storage bucket. Only the Next.js server reaches the database, with the secret
key, always scoped to the owner id in a signed httpOnly cookie (anonymous for now; eGovPH SSO will be linked to it).
RLS is on with no public policies, so the publishable key reads nothing. The device keeps a working copy (offline,
weak signal) and mirrors every change through `app/sync.ts`; a new device restores from the server.

## Kuya Hermit

`lib/hermit.ts`: an LLM via the AssemblyAI LLM Gateway (`ASSEMBLYAI_API_KEY`, model `HERMIT_MODEL`, default
`claude-opus-5-5`). It answers only through tools over HERMIT's own data: checklist, requirement details, deadlines,
offices, vault documents, the forms catalog, form pre-fill, and saving missing form values. The system prompt enforces:
replies in the owner's language (Filipino, English, or Taglish), no invented requirements or fees, no legal/tax decisions,
refuses bribes and fixers, never asks for passwords or OTPs, stays on topic, and treats document text as data. It also
classifies the business at onboarding and reads text-based PDFs in the vault. The gateway is text-only, so photos and
scans fall back to eGov AI or owner-typed details.

Paid AI calls are rate-limited in Postgres (`take_ai_quota`, `lib/ratelimit.ts`) per owner (hourly and daily) and per
hashed IP (hourly, generous for carrier CGNAT): chat 30/h · 120/day · 300/h per IP; document reading 20/h · 60/day ·
150/h; classification 10/h · 30/day · 150/h. Over the limit, chat says so in the owner's language, and reading and
classification fall back to the free filename/keyword paths.

## Forms catalog

`lib/forms.ts`: 43 forms across BIR, DTI, SEC, CDA, LGU, BFP, SSS, PhilHealth, Pag-IBIG, DOLE, FDA and BOC, each with its
official page, where it's filed, how it's handed off (online, print, or office), and fields from one shared library.
`/forms` lists them all; each form opens a pre-filled field sheet. Values the owner types (or tells Kuya Hermit) are
remembered for every later form.

## What's in it

| PRD module | Where |
| --- | --- |
| Onboarding (≤12 questions, "Hindi ko alam" everywhere, review + edit diff) | `app/onboarding`, `components/onboarding.tsx` |
| Requirements engine: rules table, universal + employer path + 4 MVP business types | `lib/engine.ts` |
| F1 Compliance dashboard: health score, Start / Operate / Hire / Renew, statuses, expiries | `app/(app)/dashboard` |
| F2 Kuya Hermit: AI assistant with tools, guardrails, Filipino/English, form pre-fill | `lib/hermit.ts`, `app/(app)/assistant`, `app/(app)/forms` |
| F3 Office locator (pilot city: Taguig) + eReport red-tape reports | `app/(app)/offices`, `lib/offices.ts` |
| F4 Calendar: generated deadlines, weekend shift, 14/3/0-day reminders, SMS, Google Calendar | `app/(app)/calendar` |
| F5 Document vault: upload, AI read, rule-based verification, per-requirement tracking, activity log | `app/(app)/vault`, `components/vault.tsx`, `lib/vault.ts` |
| "What Hermit knows": view, export, delete everything | `app/(app)/profile` |

## eGov API sockets

`lib/egov/index.ts` defines one adapter per API; `egov("sso")`, `egov("emessage")`, … return the live client when that
service's env vars are set (see `.env.example`), otherwise the mock in `lib/egov/mock.ts`. Live implementations are in
`lib/egov/live.ts`. The current mode of each service shows on the Profile page.

| API | Used for | Live status |
| --- | --- | --- |
| eGovPH SSO | Sign-in (`/api/auth/sso` → `/callback`) | Wired; login URL contract still to confirm |
| Face Liveness | Before eVerify (`/api/auth/liveness`) | Wired |
| National ID eVerify | Pull verified name, birthday, address | Wired |
| eMessage | SMS reminders | Wired (sends only to the signed-in owner's number) |
| eGov AI | Business classification, Taglish explanations, document reading | Wired; keyword / filename fallbacks |
| eGovPay | Fees (P2) | Adapter wired, no UI yet |
| eReport | Report red tape at an office | Wired |
| eGovChain | Vault anchoring (stretch) | Socket only |
| Compass | — | Not used: in egov.js it's budget data, not an office locator |

## Document verification

The AI only *reads* an upload (type, names, numbers, dates) through `egov("ai").extractDocument`. Whether it's the right,
valid document is decided by the rules in `lib/vault.ts`: document type vs. the slot it was uploaded for, owner and
business name vs. the profile and every other document, expiry, city, duplicates. A verified permit marks its checklist
item Approved with its expiry, and its TIN / registration number is saved for form pre-fill. Every upload, check, edit
and deletion goes to the activity log. Files stay on the device (IndexedDB). Until eGov AI is connected, the type is
guessed from the filename and the owner types the details, which run through the same checks.

## Not built yet

Account linking (eGovPH SSO / OTP) to recover data on a new browser, server-side reminder
scheduling, shareable compliance pack, filled official PDFs,
holiday-aware deadlines, full Filipino/English toggle, other LGUs, employer payroll module. Every rule in the seed table
is unverified until a pilot LGU and RDO sign it off.
