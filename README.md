# HERMIT

**Your business, remembered.** A compliance home base for Philippine MSME owners: one checklist of the permits,
registrations and tax filings a business needs, what's done, what's due, and an assistant that pre-fills the forms, submits it for you to the concerned agencies, and enables you to pay your bills and taxes; all in one place.

This is the early-phase build of the PRD MVP. Every eGov API is wired behind an adapter and runs on a mock, so the whole
flow works today; drop credentials into `.env.local` and each service switches to the real
[egov.js](https://github.com/omsimos/egov.js) client on its own.

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm test    # requirements engine + calendar checks
```

## What's in it

| PRD module | Where |
| --- | --- |
| Onboarding (≤12 questions, "Hindi ko alam" everywhere, review + edit diff) | `app/onboarding`, `components/onboarding.tsx` |
| Requirements engine: rules table, universal + employer path + 4 MVP business types | `lib/engine.ts` |
| F1 Compliance dashboard: health score, Start / Operate / Hire / Renew, statuses, expiries | `app/(app)/dashboard` |
| F2 Kuya Hermit: retrieval-grounded answers with sources, form pre-fill field sheets | `app/(app)/assistant`, `app/(app)/forms/[id]`, `lib/forms.ts` |
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

Database (owner data is in `localStorage`, files in IndexedDB), server-side reminder scheduling, shareable compliance pack, filled official PDFs,
holiday-aware deadlines, full Filipino/English toggle, other LGUs, employer payroll module. Every rule in the seed table
is unverified until a pilot LGU and RDO sign it off.
