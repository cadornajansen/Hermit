# HERMIT

**Your business, remembered.** A compliance home base for Philippine MSME owners: one checklist of the permits,
registrations and tax filings a business needs, what's done, what's due, and an assistant that pre-fills the forms.

The current branch combines the main branch's landing page, account screens, Manila onboarding, dashboard,
roadmap and workspace design with the early-phase forms, vault, payments, office locator and **Kuya Hermit**
workflows. The assistant uses the AssemblyAI LLM Gateway when configured, with keyword fallbacks otherwise.
Government APIs use mock adapters until their credentials are supplied, then use the
[egov.js](https://github.com/omsimos/egov.js) client. [Current implementation details](docs/IMPLEMENTATION.md)
are separate from the [approved target MVP](docs/PRD.md); an existing feature is not necessarily approved guidance.

```bash
pnpm install
cp .env.example .env.local             # configure available services as needed
pnpm dev     # http://localhost:3000
pnpm test    # engine, accounts, sync, vault, forms, payments and location checks
pnpm typecheck && pnpm lint && pnpm build
```

Without `.env.local` the app still runs: device-only storage and keyword answers instead of Kuya Hermit.

## Location coverage

The current onboarding accepts businesses in the **City of Manila**. It starts with Manila selected and
stops before saving a roadmap if another city is entered. An older profile outside Manila keeps its saved
location; to complete onboarding again, the owner must update it to Manila. The earlier searchable
region/city controls and offline `lib/locations.json` catalog remain in the repository for legacy flows,
but they are not the current onboarding interface. The catalog's source and license are recorded in
`lib/locations.LICENSE` and `lib/locations.test.ts`.

The former Taguig office and official-form data still exist for legacy matching, but new intake is limited
to Manila. A nearby office or a form available for another city does not establish Manila jurisdiction.

## Backend (Supabase)

`supabase/migrations/` holds the schema: `owners` (profile + checklist), `documents`, append-only `vault_events`,
`chat_messages`, and a private `documents` storage bucket. Only the Next.js server reaches those tables with its secret
key. Anonymous/eGov owners use a signed httpOnly owner cookie; the eGovPH SSO exchange maps its returned `uniqid` to that owner row.
Supabase email/password accounts use their Supabase user ID as a separate owner ID. Email and eGov business data
are **not linked or merged** by sign-in, matching names, or matching email addresses. Switching methods closes the
previous session and changes the client data scope. Explicit account linking is not implemented.
RLS is on with no public policies, so the publishable key reads nothing. The device keeps a working copy (offline,
weak signal) and mirrors every change through `app/sync.ts`; a new device restores from the server.
Ordinary loading keeps an existing device working copy and does not write it over the server merely because it was
loaded. Explicit SSO restore selects the server copy after pending local changes are acknowledged. Profile/checklist,
document metadata, deletions, vault events and chat clearing are queued in the owner-scoped browser snapshot before
the debounce. Reload, reconnect and the retry control resume pending work; failures remain visible and do not clear
the queue. An acknowledgement for an older edit cannot clear a newer edit. This is still a device working-copy policy,
without automatic field merging across devices. Run `node scripts/sync-reproduction.mjs` for the synthetic conflict harness.

## Kuya Hermit

`lib/hermit.ts`: an LLM via the AssemblyAI LLM Gateway (`ASSEMBLYAI_API_KEY`, model `HERMIT_MODEL`, default
`claude-opus-5-5`). It answers only through tools over HERMIT's own data: checklist, requirement details, deadlines,
offices, vault documents, the forms catalog, form pre-fill, and staging missing form values for review. The system prompt enforces:
replies in the owner's language (Filipino, English, or Taglish), no invented requirements or fees, no legal/tax decisions,
refuses bribes and fixers, never asks for passwords or OTPs, stays on topic, and treats document text as data. It also
classifies the business at onboarding and reads text-based PDFs in the vault. The gateway is text-only, so photos and
scans fall back to eGov AI or owner-typed details.

Paid AI calls are rate-limited in Postgres (`take_ai_quota`, `lib/ratelimit.ts`) per owner (hourly and daily) and per
hashed IP (hourly, generous for carrier CGNAT): chat 30/h · 120/day · 300/h per IP; document reading 20/h · 60/day ·
150/h; classification 10/h · 30/day · 150/h. Over the limit, chat says so in the owner's language, and reading and
classification fall back to the free filename/keyword paths.

## Forms catalog

`lib/forms.ts`: forms across BIR, DTI, SEC, CDA, LGU, BFP, SSS, PhilHealth, Pag-IBIG, DOLE, FDA and BOC, each with its
official page, where it's filed, how it's handed off (online, print, or office), and fields from one shared library.
`/forms` lists them all; each form opens an editable field sheet. Account details and explicitly saved answers are
labelled separately. Every value can be reviewed, changed, or cleared before filing. Current-form edits take
precedence, including intentional blanks. Where account details disagree with a saved answer, the sheet shows both;
it initially uses the account detail and offers an explicit “Use saved answer” choice. Editing a form does not edit
the account. Business addresses retain province context.

**Optional reuse:** the checkbox beside copy, print, portal handoff and PDF download is **off by default**, even
after a previous opt-in. The expandable preview lists exactly the eligible values. Continuing without checking it
does not save answers for reuse and never blocks the filing handoff. After a successful save the choice resets.
Save failures are reported separately and do not block export or external filing. HERMIT does not submit to agencies;
these choices are offered at its preparation/handoff boundary. Packet cards link to each editable field sheet for
review and optional saving; generating a packet itself does not grant consent.

`lib/form-memory.ts` owns the conservative allowlist, reviewed label aliases, consent metadata, and owner-scoped
browser persistence (`hermit:answers:v1:<owner>`). It saves names/contact addresses, business names/addresses,
barangay/city, activity/PSIC, structure/premises, RDO office code, business start date and floor area. Labels are matched
only by canonical key or exact normalized reviewed aliases, not fuzzy similarity. Generic “name”/“address”, employee,
spouse and property-owner fields are not inferred as the account owner's information. Missing, oversized or
contradictory alias values are left unresolved. Unknown uploaded-form labels are not learned automatically.

Passwords/OTPs, government and registration IDs (TIN, SSS, PhilHealth, Pag-IBIG, DTI/SEC/CDA), financial amounts/bands
and tax choices, birth dates, signatures, period/expiry data, staffing counts, products, reasons and unknown fields
are excluded from general reuse. These either expose sensitive information, describe other people, require a
filing-specific decision, or become stale. RDO is an office code, not an identification number. The policy checks
field meaning; users should not put secrets into a contact/business field. Existing account, vault and conversation
storage are separate: this feature does not erase those records. Legacy `profile.extra` values are visible in Profile
but are no longer treated as consented form answers. Chat's form tool stages session-only suggestions; it cannot
grant reuse consent or overwrite a value already edited on the current form.

**Review/delete:** Profile → Saved form information shows saved values, source form and update date. Each can be
updated or deleted; “Withdraw consent and delete saved answers” removes the whole reusable record. Another tab on
the same origin receives changes through the storage event. Deletion does not edit an already-open form or revoke a
downloaded file. Account details can still pre-fill forms and are edited through the existing profile wizard.

**Storage and isolation:** reusable answers are device-local, with no cloud mirror or database migration. They
survive reloads for the same resolved owner ID, but do not travel to a new device or survive cleared browser
storage/cookies. The signed server owner must be resolved before displaying persisted account information; saving,
editing and deletion recheck that owner. Existing account/checklist/vault server sync stays separate. Local account
snapshots now use `hermit:owner:v2:<owner>`; stale server writes are rejected if the cookie's owner has changed.
eGov SSO restores only an owner mapped to that verified identity. A new identity receives a fresh owner instead of
overwriting the previous citizen's row. Without a backend, the cookie is retained only when the previous signed
session proves the same identity; a changed or expired identity session starts a fresh scope.
Unscoped legacy `hermit:v1` snapshots and `hermit:fill:*` drafts are not automatically imported, since their owner
cannot be proven. They remain on disk until existing delete-all cleanup; a server-backed profile can restore,
otherwise the owner needs to complete onboarding again. Initial account loading and consent changes require a
connection to verify the signed session. A previously verified open form can still be used without saving.

Current-form edits and PDF drafts/signatures are **session-only** and never automatically written to browser
storage. Navigating between sheets, PDF editors and packets retains that session's work; reloading clears it.
PDF drafts are keyed by owner, file and layout hash/version, and never shared between owners. A session PDF draft
keeps its edits when account/saved details change; use Reset explicitly to refill from the latest sheet. Only whole
mapped PDF values are candidates for opt-in reuse; split name parts, conflicting repeated boxes, marks, signatures
and unlabelled free text are not reconstructed. Use the field sheet to save a full name. “Start a fresh form” clears
that form's session answers and PDF edits, useful for a new filing period, without deleting reusable information.

**Checks:** `pnpm test` covers strict consent, eligible/excluded categories, aliases, missing values, conflicts,
intentional clearing, persistence/reload, updates/deletion/withdrawal, PDF correction extraction, owner switches and
stale-write rejection, including SSO transitions, a switch during hydration, PDF file changes, and handoff when saving
is declined or fails. Store and Server Action tests run production logic with in-memory storage and stubbed
cookie/database boundaries; a rendered field-sheet check verifies editable account values and unchecked consent.
No live identity/database service or official-form placement accuracy is claimed by those tests. General multi-device
account sync follows the device working-copy policy and durable retry queue described above; reusable answers
deliberately avoid that path.

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

**Document packets:** packet cards select forms by filing task and ownership type. New sole-proprietor BIR
registration uses 1901; choose update/cancellation or abatement explicitly for 1905 or 2121. DTI new registration and
renewal are separate choices. The cover records each form's inclusion reason. Each official PDF is fetched and
prepared once before the cover is written; failure produces an info-sheet label, reason and matching info-sheet
pages. A verified vault copy is counted as included only after its bytes have been decoded and embedded successfully.
Files awaiting review, rejected files and fetch/decode/embed failures are listed as unavailable/omitted with reasons.
Uploads accept PDF, PNG and JPEG. Convert WebP/HEIC/other images before uploading; older unsupported files stay in
the vault but are explicitly omitted from packets. Taguig's stored application is only offered for a matching
canonical Taguig jurisdiction; other locations receive general information sheets and LGU confirmation guidance.

**Paying taxes:** `/pay` is HERMIT's payment terminal for BIR returns (2551Q, 1701Q, 2550Q, 1601-C, 0605 and more),
pre-filled from the profile and ordered by what's due; the owner enters the amount from their return (HERMIT never
computes tax). It creates an eGovPay transaction and shows a scan-to-pay QR of eGovPay's payment page plus a link, then
watches the status. A payment is marked paid only when eGovPay reports it (status poll and `/api/pay/callback` both
re-read the transaction); the receipt shows eGovPay's reference number. Payments are stored in the `payments` table.
eGovPay's checkout offers QR Ph, e-wallets, online banking, banks, LANDBANK QR and cash, with a small convenience fee
per channel. `EGOV_PAY_TOKEN` is the `test_`-prefixed token (test mode, no live funds); drop the prefix to go live.
Without a token the terminal says online payment isn't available yet and points to BIR's own ePayment channels.

**Office finder:** choose a document/service and confirm the business jurisdiction before comparing offices.
Only active, current registry records with evidence of that exact service and area coverage are eligible.
The maintained registry (`lib/office-registry.ts`) is intentionally empty pending independent verification;
legacy Taguig seeds remain labelled unverified, not promoted to eligible branches. The assistant and packet
branch lookup use the same resolver. Requirement details link directly to the relevant office search.

The approved provider is Google only: Maps JavaScript for display, server-side Geocoding for an explicitly
submitted starting address, and external Google Maps directions links. No Places discovery or Routes calls
are made. Device location is requested on demand, denial preserves the choice, and address matches require
confirmation. Distances say “Approximate straight-line distance”; missing/stale coordinates stay unranked.
The map and selected office list synchronize, with the scrollable list on the right on desktop and below
the map on small screens. Textual results remain available when the map fails.

Live map/address features default off (`OFFICE_FINDER_ENABLED=false`). Before enabling, supply independently
reviewed office records, restricted Google browser/server keys and a production map ID, publish appropriate
terms/privacy disclosures, and configure provider-side quotas. Geocoding also requires the existing Supabase
`take_ai_quota` RPC: each upstream attempt reserves owner/IP/project quota and fails closed if unavailable.
The default rolling project cap is 250 geocodes/day (`GOOGLE_MAPS_GEOCODE_DAILY_LIMIT`); browser map loads
need separate Google Cloud limits. Precise origins and entered addresses are transient and are not cached
server-side or saved to the business profile. No billing/resources are enabled by this code.
See [office finder setup, data review, verification and future staggered scaling](docs/office-finder-plan.md).

**Start here:** `lib/processes.ts` lists, per requirement and filing task, the page that starts the process (BNRS, ORUS with its
click path, eSPARC, CDA, Taguig TLC Portal, BFP FSIS, BMBE online, FDA eServices, Business Hub, My.SSS, PhilHealth,
DOLE, eFPS/eBIRForms) or the office to visit, each checked by hand on the date shown. The dashboard and Kuya Hermit
give these word for word. LGU portals also require a matching canonical region/province/city: Taguig links use its
PSGC jurisdiction, while unsupported or ambiguous places get general guidance to confirm with their LGU.
Jurisdiction stays visible in packet covers, dashboard guidance and Offices. Currently 31 files for 24 forms (BIR, SSS, PhilHealth, Taguig); Pag-IBIG
(reCAPTCHA), BFP and DOLE (bot-blocked) and the DTI BMBE flyer (server unreachable) stay link-only for now.

## What's in it

| PRD module | Where |
| --- | --- |
| Seven-step Manila onboarding with multiple activities, uncertainty, and review | `app/onboarding`, `components/onboarding.tsx` |
| Requirements engine: shared tasks plus activity and employer branches | `lib/engine.ts` |
| Main's dashboard and roadmap UI with status and expiry tracking | `app/(app)/dashboard`, `app/(app)/roadmap` |
| Email/password and eGov sign-in with separate owner scopes | `app/register`, `app/egovph/sso`, `lib/session.ts` |
| F2 Kuya Hermit: AI assistant with tools, guardrails, Filipino/English, form pre-fill | `lib/hermit.ts`, `app/(app)/assistant`, `app/(app)/forms` |
| F3 Office locator and eReport red-tape reports (legacy Taguig data remains) | `app/(app)/offices`, `lib/offices.ts` |
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
business name vs. the profile and every other document, expiry, city, duplicates, and minimum readable evidence.
Confirmation records the owner's review; it cannot supply missing names, numbers or dates, or dismiss warnings.
Supported permits/certificates require identity details, a document number (TIN for COR), a valid issue date and,
where applicable, expiry. Leases require identity, property address and issue date; IDs require a name and number.
Company documents also require the business name. Unknown or insufficient evidence stays in review.
The first reader output and subsequent owner corrections are retained separately in the extracted JSON metadata.
“Verified” describes document identity/detail checks, not authenticity, completed applications or official issuance.
HERMIT does not automatically approve checklist items from an upload or confirmation; update checklist status
separately after agency issuance. Existing checklist statuses are retained for the owner to review.
A verified document's TIN / registration number is saved as vault metadata. Every upload, check, edit
and deletion goes to the activity log. Files stay on the device (IndexedDB). Until eGov AI is connected, the type is
guessed from the filename and the owner types the details, which run through the same checks.

Runtime acceptance results, changed files and verification limits are recorded in [docs/runtime-fixes.md](docs/runtime-fixes.md).

## Not built yet

Server-side reminder
scheduling, shareable compliance pack,
holiday-aware deadlines, full Filipino/English toggle, other LGUs, employer payroll module. Every rule in the seed table
is unverified until a pilot LGU and RDO sign it off.
