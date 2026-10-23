# Hermit — Scope and implementation inventory

This file owns target feature inclusion and deferral. Its detailed inventory below is a **historical
baseline at commit `10426a1`**, before the main/early-phase merge. For current behavior, use
[Current implementation](IMPLEMENTATION.md). The target comparison is not an instruction to
remove existing routes, data, or integrations.

## Approved coverage

| Dimension | Target |
| --- | --- |
| Jurisdiction | City of Manila, with relevant national registration paths. |
| Legal forms | Sole proprietorship; partnership; One Person Corporation (OPC); other domestic corporation; cooperative. Undecided triggers clarification. |
| Activities | Retail; food service; water refilling; manufacturing; professional services; personal services; repair; other. Multiple selections are supported. |
| Professional status | Freelancer/professional status is captured separately from legal organization. |
| Journeys | Opening; renewing; updating; closing. |
| Supported updates | Address changes within Manila and adding/removing activities. |
| Employer guidance | Initial employer setup and applicable registration-ending steps in a reviewed closure journey. Recurring payroll/contribution calendars are deferred. |

All five decided forms and seven named activity categories require researched guidance. “Other” is a catch-all, not a promise to cover arbitrary industries. Unreviewed subtypes, complex cases, missing facts, and unsupported combinations must receive explicit coverage notices. Category availability does not imply exhaustive legal coverage.

Closure means a sourced roadmap for ending applicable registrations and permits. It does not include calculations of final taxes, employee settlements, or a guarantee of legal dissolution. Updates to business name, ownership, legal form, and moves to other LGUs remain outside the supported updating journey.

## Approved feature decisions

- Editable manual intake, conditional questions, uncertainty handling, and a review step.
- Deterministic sourced roadmaps with prerequisites and shared-task deduplication.
- Four recorded task statuses, manual notes and dates, and a next-action dashboard.
- eGov SSO or Supabase email/password accounts, with explicit authenticated linking.
- Supabase Postgres storage and multiple businesses per account.
- Confirmed-date `.ics` export and read-only offline access after online caching.
- English-only sourced AI roadmap Q&A with transient conversation context.
- AssemblyAI transcription in AI chat only, followed by editable text and explicit sending.
- Reviewed published fees and processing times, with missing information labelled.
- Pale-blue design, desktop sidebar, compact mobile navigation, and an empty Office Locator page.
- Next.js server deployment with protected server routes; static-export-only hosting is superseded.

## Deferred or excluded from the target MVP

| Area | Decision |
| --- | --- |
| National ID eVerify and face-liveness verification | Deferred; login alone must not imply National ID verification. |
| Automatic SMS/email/push reminders | Deferred. Dashboard dates and calendar-file export remain approved. |
| Recurring tax returns, payroll reports, contribution calendars | Deferred. |
| AI category suggestions | Deferred; owners select activities manually. |
| Persistent chat memory | Deferred; saved business data is separate from conversation history. |
| Automatic form filling and generated application documents | Deferred. Reviewed official form links remain permitted. |
| Document vault, uploads, OCR, document validation | Deferred. Manual notes and dates remain approved. |
| Payments and eGovPay | Deferred. Official portal links remain permitted. |
| Automatic rule/form/source monitoring | Deferred; publication uses manual review. |
| Helper/bookkeeper invitations and delegated access | Deferred; each account manages its own businesses. |
| Multilingual UI or AI replies | Deferred; English only. |
| Voice input outside AI chat; speech output/voice-agent conversations | Outside the approved voice scope. |
| Budget/savings estimates, automatic BMBE eligibility, tax-option advice | Deferred as a group. |
| eReport and eGovChain | Deferred. |
| Direct calendar synchronization and automatic recurring calendar events | Outside the approved export scope. |
| Automated filing, other LGUs, and Negosyo Quest | Outside the MVP. |

## Historical implementation inventory

Baseline: commit `10426a1`, inspected 22 October 2026. “Implemented” means a code path exists, not that a live government integration or its legal claims were verified. Mock means simulated behavior; unreviewed means content has not passed the publication gate. Deferred features may currently be implemented.

| Feature | Current behavior and evidence | Approved target | Status relative to target |
| --- | --- | --- | --- |
| Runtime and stack | App Router, server actions, TypeScript, Tailwind and shadcn; [package](../package.json), [config](../next.config.ts). | Next.js server deployment with protected integrations. | Foundation exists; live integration readiness unverified. |
| Intake | A step-based editable questionnaire; [onboarding](../components/onboarding.tsx). | Manual conditional intake with explicit unknowns. | Partial; reusable UI. |
| Forms and activities | One category: retail, food service, packaged food, or other; OPC grouped with corporation; [types](../lib/types.ts). | Separate OPC, five decided forms, multiple activities across the approved list. | Differs; coverage missing. |
| Journeys | Planning/unregistered/registered; [types](../lib/types.ts). Matching ignores city and stage; [engine](../lib/engine.ts). | Manila-aware opening, renewal, supported updates, and closure. | Missing target journey behavior. |
| Uncertainty and deduplication | Explicit unknowns can become `maybe`; missing flags become false; each requirement record emitted once; [engine](../lib/engine.ts). | Missing facts trigger clarification; uncertainty retained across dependencies; shared tasks deduplicated across activities. | Partial. |
| Requirement sources | 27 seeds with `lastVerified: null`; broad agency links and unreviewed fees/dates; [engine](../lib/engine.ts). | Reviewed official evidence, effective information, jurisdiction and library version. | Unreviewed; not publication-ready. |
| Progress and readiness | Six statuses, expiry-derived states, dashboard blockers; [types](../lib/types.ts), [dashboard](../app/(app)/dashboard/page.tsx). | Four progress statuses, separate readiness/expiry, period-safe dependencies. | Differs. |
| Notes and dates | Task state stores status/expiry; automatic year-end expiry in dashboard; [types](../lib/types.ts), [dashboard](../app/(app)/dashboard/page.tsx). | Manual notes, typed dates, confirmation and provenance. | Partial; target date model missing. |
| Dashboard | Checklist, progress/health summary, blocks, vault slots and prefill links; [dashboard](../app/(app)/dashboard/page.tsx). | Selected-business next action and progress without a legal-compliance score. | Partial; contains deferred surfaces. |
| Persistence | One global profile/task/chat store in `hermit:v1`; [store](../lib/store.ts). | Supabase-backed, account/business-isolated data. | Missing cloud storage and isolation. |
| Multiple businesses | One profile, no selector; [store](../lib/store.ts). | Separate businesses with explicit switching. | Missing. |
| Email/password and linking | No Supabase client/schema or linking flow in baseline; [package](../package.json), [session](../lib/session.ts). | Supabase accounts and explicit eGov linking. | Missing. |
| eGov sign-in | Callback proceeds through liveness/eVerify; credential presence chooses live or mock adapters; [callback](../app/api/auth/callback/route.ts), [adapters](../lib/egov/index.ts), [mock](../lib/egov/mock.ts). | eGov sign-in without separate National ID verification; real authenticated account mapping. | Partial adapter; deferred verification remains active; mocks are not verification. |
| Logout and reset | Cookie sign-out separate from local/IndexedDB deletion; [actions](../app/actions.ts), [profile](../app/(app)/profile/page.tsx). | Sign-out clears personal cache and transient chat; confirmed destructive actions are scoped explicitly. | Differs. |
| Calendar | Recurring tax/payroll/suggested dates and blanket weekend shifting; Google Calendar template links; [engine](../lib/engine.ts), [calendar](../app/(app)/calendar/page.tsx). | Eligible confirmed-date `.ics` export with year-specific provenance. | `.ics` missing; existing behavior exceeds/differs from target. |
| Reminders | Reminder-date display and manual SMS action; mock/live adapter; [calendar](../app/(app)/calendar/page.tsx), [actions](../app/actions.ts). No scheduled worker found. | Automatic reminders deferred. | Deferred UI/action present; scheduler missing. |
| PWA/offline | Manifest exists; no service-worker registration or app cache found; local edits remain possible; [manifest](../app/manifest.ts), [store](../lib/store.ts). | Cached app plus read-only account/business snapshots. | Manifest only; offline target missing. |
| AI Q&A | Rule-based retrieval, eGov AI explanation or mock facts, Taglish text, citations, prefill links; [actions](../app/actions.ts), [chat](../components/chat.tsx), [live adapter](../lib/egov/live.ts). | English Q&A from reviewed content, selected-business context and no record mutations. | Reusable retrieval shell; content unreviewed and target boundaries differ. |
| Chat memory | Messages persisted with the global profile; [chat](../components/chat.tsx), [store](../lib/store.ts). | Transient chat cleared on business switch/logout. | Persistent behavior currently present; deferred target feature. |
| Voice | Text-only chat; no AssemblyAI dependency or microphone path found; [chat](../components/chat.tsx), [package](../package.json). | AssemblyAI voice input in chat only. | Missing. |
| Office Locator | Populated Taguig offices, directions and eReport; [offices page](../app/(app)/offices/page.tsx), [office data](../lib/offices.ts). | Empty Office Locator page and sidebar entry. | Differs; existing functionality stays active for now. |
| Vault/OCR | Uploads, IndexedDB files, extraction/fallback, checks, identifiers and task auto-approval; [vault UI](../components/vault.tsx), [vault rules](../lib/vault.ts), [files](../lib/files.ts). | Deferred. | Implemented; not approved for target scope. |
| Form filling | Profile-mapped field sheets with print/copy, linked from dashboard/chat; [form sheet](../components/form-sheet.tsx), [form data](../lib/forms.ts), [form route](../app/(app)/forms/[id]/page.tsx). | Deferred. | Implemented field sheets; not populated official PDFs. |
| AI classification | Description classifier in intake with keyword fallback; [onboarding](../components/onboarding.tsx), [mock](../lib/egov/mock.ts). | Deferred. | Implemented. |
| Financial tools | BMBE/tax-option/withholding seeds and assets/sales/tax questions; [engine](../lib/engine.ts), [onboarding](../components/onboarding.tsx). | Advisory/eligibility tools and recurring tax/payroll guidance deferred. | Deferred behavior present; content unreviewed. |
| Fees and processing | Seed strings appear in task details; [engine](../lib/engine.ts), [dashboard](../app/(app)/dashboard/page.tsx). | Only reviewed officially published information. | Display exists; evidence gate unmet. |
| Payments/eGovChain | Mock/live payment adapters and a chain socket; [adapters](../lib/egov/index.ts), [live](../lib/egov/live.ts), [mock](../lib/egov/mock.ts). No payment UI found. | Deferred. | Adapter/socket only; live readiness unverified. |
| Language and design | Filipino/Taglish copy, green theme, narrow desktop column, bottom tabs, Geist and theme switching; [CSS](../app/globals.css), [layout](../app/(app)/layout.tsx), [navigation](../components/nav.tsx), [root layout](../app/layout.tsx). | English, pale-blue direction, system typography, desktop sidebar and mobile navigation. | Differs; no styling changes in this checkpoint. |
| Source monitoring/shared access | No scheduler, invitations or permissions system found in baseline. | Deferred. | Not found; not planned for MVP. |

## Scope control

Older assumptions of one business, local-only storage, no accounts, no AI, three journeys, and static-export-only hosting are superseded by explicit owner approvals. The earlier `asikaso` project location is also superseded by this existing repository.

Future code work must be requested and handled in small, focused changes. Preserve working behavior until a specific revision is authorized. Do not delete existing browser data, upload files, routes, integrations, or tests simply because this file records a target mismatch. Record new behavior in [Current implementation](IMPLEMENTATION.md); retain this table as historical comparison evidence.
