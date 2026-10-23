# Hermit — Functional specification

Status: intended target behavior. This document does not describe a completed migration. Compare it with
[the merged implementation](IMPLEMENTATION.md) and the [historical baseline inventory](SCOPE.md#historical-implementation-inventory).

## Data flow and architecture

```text
Authenticated owner -> selected business -> profile answers
  -> reviewed applicability rules -> sourced roadmap
  -> owner task/date updates -> Supabase Postgres
  -> dashboard + eligible calendar export

Selected business + reviewed library -> server-side AI Q&A -> cited explanation
Chat microphone -> AssemblyAI -> editable text -> explicit Send -> AI Q&A
Last successfully saved data + cached app/library -> read-only offline view
```

Use Next.js App Router with TypeScript, Tailwind CSS and shadcn/ui, deployed with a runtime server. Supabase Postgres holds authoritative owner data; Supabase Auth provides Hermit's email/password accounts. Keep government exchanges, AI requests and provider credentials in protected server code. Static-export-only deployment is no longer a requirement.

The following are behavior-level data contracts, not SQL migrations or a requirement to rename current source symbols in this checkpoint.

## Accounts and business context

- Permit email/password registration/login and eGov SSO login. Use provider-supported email confirmation and account recovery for Hermit accounts.
- Validate government responses server-side and map the stable provider identity to the app account. Do not use names or editable profile fields as identity proof.
- Offer explicit linking initiated by a signed-in owner who authenticates the second method. Reject attaching an identity already owned by another account. Matching names or email addresses alone must not merge accounts.
- SSO sign-in and National ID verification are distinct. Separate eVerify/liveness is deferred; no National-ID-verified badge follows ordinary sign-in.
- Every business has its own identifier and an owning account. Validate ownership on each server operation and enforce access policies for exposed database records. Client-supplied business IDs are not authorization.
- Use Supabase Row Level Security (RLS), meaning database rules restricting which rows an authenticated owner can access. Administrative secrets must never reach the browser.
- Business switching changes the active profile, roadmap, tasks, dates, assistant context and export scope. Clear transient chat and unsent voice context; discard late assistant responses for the previous business.
- Sign-out clears personal caches and transient chat as well as the session. A new account must not see a previous account's local data.

The eGov-to-Supabase session/linking mechanism requires a separately verified integration design. Do not assume eGov is a built-in Supabase OAuth provider or that all provider types support the same linking API.

## Business profile

| Information | Required target meaning |
| --- | --- |
| Business identity | Stable business ID, owner account ID, and an owner-readable name/label for switching. |
| Legal form | Sole proprietorship, partnership, OPC, other domestic corporation, cooperative, undecided; preserve uncertainty when unanswered. |
| Activities | Multiple selections from the approved categories; optional description for Other. |
| Professional/freelancer status | Separate from legal form and activity; include “I'm not sure.” |
| Location | City of Manila business address and barangay. Unsupported locations produce a coverage notice. |
| Premises | Relevant home/rented/owned details and source-driven follow-up questions. |
| Employees | Presence/count information needed by reviewed applicability rules, with unknown supported. |
| Journey | Opening, renewing, updating, closing. For updating, capture address/activity change details needed by reviewed procedures. |
| Roadmap metadata | The reviewed library version used for the saved roadmap. |

Ask additional questions only when a reviewed rule needs the answer. Keep unknown, undecided, unsupported, and explicit no distinct. A professional is not automatically assigned a sole-proprietorship path. AI category prediction is deferred.

## Requirements and matching

Each publishable requirement record needs:

- Stable ID, title, plain-English explanation, supported journey/jurisdiction and applicability conditions.
- Prerequisites and preparation/document guidance, with dependencies accurate for the selected legal path.
- Issuing office, official submission website or location, and official source URL(s).
- Review date and effective-date information. Use “Not stated” when the source gives no effective date; do not fabricate one.
- Published deadlines and their valid period/year, where supported.
- Optional published fees and processing times with their supporting source context; otherwise show “Confirm with the office.”

Bundle a manually curated, versioned library. A record with a URL but no completed review is a research seed, not approved guidance. See the [publication gate](SOURCES.md#requirements-publication-gate).

Matching returns applicable, not applicable, or needs clarification/confirmation. Missing facts must not silently become false. Combine matches across activities using stable shared requirement identity. Different legal forms must select the relevant registration path, including distinguishing OPC from other corporations.

Only relevant prerequisite paths apply; do not require mutually exclusive legal-form registrations together. Unknown applicability of a prerequisite cannot be treated as satisfied. Show unresolved questions and unsupported combinations without describing the resulting roadmap as complete.

Opening, renewal, updating and closure use reviewed journey-specific rules. Do not rerun a new-registration checklist for an existing business by default. Selecting closing does not cancel obligations or declare the business legally closed; those outcomes need recorded, confirmed task/document information.

## Progress, reconciliation and dashboard

Recorded statuses are `not_started`, `preparing`, `submitted`, and `completed`. Blocked readiness, waiting for an office, upcoming expiry, and overdue dates are separate derived indicators.

Task progress belongs to a business and a requirement occurrence. Store the requirement identity, relevant period/occurrence, status, owner notes and associated dates. Completion of last year's renewal must not complete this year's task. Retain matching work when profile answers change; remove irrelevant tasks from the active view without silently discarding saved work. Any future import of the legacy browser profile must be explicit and assigned to the authenticated owner.

Only completed prerequisites satisfy dependencies. Readiness must not rewrite owner-recorded progress. Updating a status never automatically invents an expiry date, approves uploaded evidence, or submits to a government agency.

The dashboard prioritizes required clarification, then ready tasks with the earliest eligible confirmed deadline, then the reviewed prerequisite order. Show submitted tasks awaiting completion, blocked tasks with their prerequisites, and upcoming obligations. When nothing is actionable, explain whether the owner is waiting for an office or has completed the currently tracked tasks. Keep coverage limits visible.

Use labels such as “3 of 8 tracked tasks completed,” not a legal compliance score. The owner must see save failures rather than an inaccurate saved confirmation. Destructive reset/delete actions require an explicit, business-scoped description and confirmation; logout itself does not delete cloud business records.

## Dates and calendar export

Represent date kind separately: document expiry, filing deadline, or preparation date. Keep a date-only value, business/requirement association, valid period, and provenance. Provenance distinguishes a reviewed applicable rule from an owner-entered date and records explicit owner confirmation where needed.

A reviewed rule can produce an exportable date only when its period/year and all necessary business facts are known. An owner-entered date requires explicit confirmation. Show the origin and uncertainty of dates in the app; confirmation does not turn an owner's entry into an officially sourced deadline.

Never reuse a dated extension in a later year automatically. Derive later-year recurring deadlines only where an explicitly reviewed recurring rule supports that period. Do not apply a generic weekend/holiday shift without the relevant reviewed rule. Recurring tax/payroll calendar generation is deferred.

Export the selected business's eligible dates as a downloadable `.ics` file for manual import. Use all-day events so date-only obligations remain on the intended Philippine calendar day. Distinguish the event kinds and include their source or owner-confirmed origin. Exclude uncertain/unconfirmed dates and unsupported rule periods. Do not add recurrence rules, notifications, or calendar-account permissions. Updating the app does not automatically update a previously imported calendar file.

## AI roadmap Q&A

The assistant is English-only and read-only. Authenticate requests and resolve the selected business server-side. Retrieve relevant content from the same reviewed library used for its roadmap and include only the needed profile/task context.

Every supported answer includes relevant official citations and review dates. Explain unsupported questions or gaps and direct the owner to the relevant official contact/source where known. Do not use unreviewed seeds or the model's general knowledge to invent legal requirements, amounts, dates, or procedures. Do not answer deferred tax-option/advisory questions as an approved capability.

The assistant cannot select activities, change rule applicability, update status/date records, fill forms, upload documents, or file applications. Its current conversation is transient; do not persist a chat history in Supabase, local storage, or the offline snapshot. Saved business profiles are not conversational memory. Clear chat on business switch and logout. Provider retention is a separate implementation dependency.

Provider failures should leave the roadmap usable and show a clear retryable chat error. A factual fallback may only use reviewed content and must not be represented as a successful model response.

## AssemblyAI voice input

Provide a microphone control in AI chat only. The owner explicitly starts recording, sees a recording indicator, can stop/cancel, and receives editable English transcription text. Sending remains a separate explicit action. Voice does not change categories, fill the questionnaire, edit notes, or perform actions automatically.

Protect the AssemblyAI API key server-side. For browser streaming, obtain a short-lived token from an authenticated server endpoint; prevent unrestricted token issuance. On cancel, navigation, business switch, sign-out or completion, stop microphone capture and close the transcription session.

Hermit does not persist audio files. Do not claim that AssemblyAI never retains or processes audio: verify the selected provider mode and settings, and disclose them accurately. On denied microphone access, network errors or transcription failures, keep ordinary text input usable and preserve the owner's existing draft where possible. Voice is online-only; speech output is not included.

## Offline reading and navigation

Provide an installation manifest and cache the app assets and reviewed library needed for reading. Cache successful saved snapshots under both account and business identifiers; Supabase remains authoritative. Display the snapshot/library version and offline state. Only promise offline availability once the relevant cache has succeeded.

Offline actions are read-only: no profile edits, task/date changes, login, AI calls, transcription, or queued writes/synchronization. Government links require internet. On reconnection, reload authoritative data rather than treating an old snapshot as a pending write. Signing out clears personal snapshots and transient chat; provider credentials, raw government tokens and audio do not belong in those snapshots.

Use a desktop sidebar and mobile-friendly navigation with explicit active-business context. Office Locator has a navigation entry and an otherwise empty page for this MVP. Do not add office lists, maps or reporting controls to that page. Issuing office and official submission information still appear in requirement details. The current populated page remains unchanged until a separate code revision is requested.

## Acceptance scenarios

These are future target acceptance tests, not results of this documentation change.

| Scenario | Expected result |
| --- | --- |
| Legal forms | Different reviewed fixtures select their appropriate paths; OPC is distinct; undecided produces clarification. |
| Mixed activities | Relevant activity requirements combine and shared tasks appear once. Other/unsupported cases keep coverage notices. |
| Unknown details | Missing answers remain unresolved; unknown prerequisites do not count as completed. |
| Dependencies | Submitted prerequisites remain incomplete; completing the applicable prerequisite unblocks dependents. |
| Profile/journey edits | Matching progress survives; old-period completion does not transfer to a new renewal; closing does not imply legal closure. |
| Accounts | Each login method works when configured; explicitly linking authenticated identities reaches the same businesses; mismatched accounts stay separate. |
| Isolation | Account A cannot access account B's businesses; switching businesses isolates progress, dates, caches and chat. |
| Persistence | Online saves survive refresh, browser reopening and sign-in on another browser with the same account. Save failures are visible. |
| Offline | After successful caching, saved data is readable offline and editing is unavailable; logout clears personal snapshots. |
| Calendar | Only eligible confirmed dates export; kinds/provenance remain visible; old extensions and unjustified weekend shifts are rejected; imported all-day dates do not drift. |
| AI | Answers use reviewed content and valid citations; unsupported requests disclose limits; no task mutation or persistent history occurs. |
| Voice | Only chat offers dictation; transcript edits precede explicit Send; cancel/permission failures leave text entry usable; no Hermit audio persistence. |
| Fees and sources | Unreviewed records are not published as supported guidance; absent official fees/times remain unconfirmed. |
| UI | Mobile and keyboard flows remain understandable; target Office Locator is empty; English labels and non-color-only statuses are used. |

## Implementation dependencies

Resolve these during specifically requested implementation checkpoints; no credentials or integrations are created by this document:

- Approved eGov access, callback contract, stable identity fields, and the verified bridge to Supabase sessions/linking. Sandbox/mock success is not live citizen verification.
- Supabase project, authenticated ownership schema, policies, and explicit legacy-data handling.
- AI provider/model selection, access, cost limits, context limits, retention, and evaluation against the reviewed library.
- AssemblyAI access, browser support, session limits, and provider processing/retention settings.
- Official source curation for each supported form/activity/journey; effective periods and deadline evidence.
- Hosting/PWA cache behavior and icons suitable for the intended demo browsers.

Do not infer that a pending dependency is approved, provisioned or working because an adapter or screen exists.
