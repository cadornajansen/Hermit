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
key, always scoped to the owner id in a signed httpOnly cookie. Owners start anonymous; signing in with eGovPH binds their `uniqid`, so the same data opens on any device.
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

**Official copies:** `pnpm forms:sync` downloads each form's official blank PDF/Excel (and agency guides) listed under
`files:` in `lib/forms.ts`, checks it's a real PDF/Excel file, stores it in Supabase Storage (public `forms` bucket) with
its extracted text, and writes `lib/form-files.json` (sha256, size, retrieved date). Form pages offer the download;
Kuya Hermit reads the stored text (`read_official_form`) to explain items and attachments. Re-run the sync to detect new
versions: it reports files whose hash changed.

**Filling the real form:** each stored PDF has an editor at `/forms/<id>/fill` that opens already filled in. The AI
behind the gateway is text-only, so `pnpm forms:layout` (once per file version) first "sees" each page for it
(`scripts/form-vision.mjs`): it renders the page, detects every drawn box and one-character cell, and reads every word
from the text layer or, for scanned forms like SSS R-1, two OCR passes (tesseract.js). Kuya Hermit then picks the box,
sub-label, name part (last / first / middle) and format (capitals, MM/DD/YYYY) for each answer, plus the signature
line and date; a review pass adds anything it missed. Code then enforces form conventions (name sub-labels,
"PRINTED NAME / SIGNATURE / DATE" lines, barangay / city, CAPITAL LETTERS) and rejects answers whose box label
doesn't match (e.g. an email in the WEBSITE box). Results go to `lib/form-layouts.json`. In the editor the owner
just checks, taps "Pirmahan" (the signature drops onto the signature line), and downloads; any answer can still be
edited, moved or removed. Everything runs on the device; the signature and filled PDF are never uploaded.

**Paying taxes:** `/pay` is HERMIT's payment terminal for BIR returns (2551Q, 1701Q, 2550Q, 1601-C, 0605 and more),
pre-filled from the profile and ordered by what's due; the owner enters the amount from their return (HERMIT never
computes tax). It creates an eGovPay transaction and shows a scan-to-pay QR of eGovPay's payment page plus a link, then
watches the status. A payment is marked paid only when eGovPay reports it (status poll and `/api/pay/callback` both
re-read the transaction); the receipt shows eGovPay's reference number. Payments are stored in the `payments` table.
eGovPay's checkout offers QR Ph, e-wallets, online banking, banks, LANDBANK QR and cash, with a small convenience fee
per channel. `EGOV_PAY_TOKEN` is the `test_`-prefixed token (test mode, no live funds); drop the prefix to go live.
Without a token the terminal says online payment isn't available yet and points to BIR's own ePayment channels.

**Start here:** `lib/processes.ts` lists, per requirement, the exact page that starts the process (BNRS, ORUS with its
click path, eSPARC, CDA, Taguig TLC Portal, BFP FSIS, BMBE online, FDA eServices, Business Hub, My.SSS, PhilHealth,
DOLE, eFPS/eBIRForms) or the office to visit, each checked by hand on the date shown. The dashboard and Kuya Hermit
give these word for word. Currently 31 files for 24 forms (BIR, SSS, PhilHealth, Taguig); Pag-IBIG
(reCAPTCHA), BFP and DOLE (bot-blocked) and the DTI BMBE flyer (server unreachable) stay link-only for now.

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
| eGovPH SSO | In-app entry `/egovph/sso?exchange_code=…` + the official "Login as eGov" widget; binds the eGovPH `uniqid` to the owner so their data follows them | **Live** |
| Face Liveness | eVerify Web SDK in the browser, before the PhilSys match | **Live** |
| National ID eVerify | Match name + birthday + face against PhilSys; fills the verified name, birthday and address | **Live** |
| eMessage | SMS reminders | Wired (sends only to the signed-in owner's number) |
| eGov AI | Business classification, Taglish explanations, document reading | Wired; keyword / filename fallbacks |
| eGovPay | Tax payment terminal `/pay` (QR + payment link, status, receipts) | **Live** (test-mode `test_` token) |
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

Server-side reminder
scheduling, shareable compliance pack,
holiday-aware deadlines, full Filipino/English toggle, other LGUs, employer payroll module. Every rule in the seed table
is unverified until a pilot LGU and RDO sign it off.
