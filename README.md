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

**Offices near you:** with Google Maps keys set, Offices finds the nearest real offices the owner needs (barangay hall,
city hall/BPLO, BIR RDO, BFP, health office, Negosyo Center, SSS, PhilHealth, Pag-IBIG, DOLE, FDA) around their phone's
location or their geocoded business address, via Places API (New) Text Search on the server (`app/maps.ts`, rate-limited,
Pro-tier fields only, location rounded to ~110 m). Results are name-checked per office type (`lib/nearby.ts`) and shown
as colour-coded pins on a Google map with distance and directions. Where jurisdiction matters (RDO, city hall,
barangay) the page says the nearest office isn't necessarily the one that handles the owner.
Business-address searches retain province and region and avoid repeating locality text already in the address.
Cached address searches retain the geocoded center. Successful empty searches show “No matches”; partial results name
the office types that failed; total upstream failure shows “Maps unavailable”. Empty, partial and unavailable states
offer retry, and incomplete results are not cached.

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
