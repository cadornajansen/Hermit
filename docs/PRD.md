# Hermit — Product requirements

Status: approved target MVP. This is a product contract, not a completed-feature report. See
[Scope](SCOPE.md) for target decisions and [Current implementation](IMPLEMENTATION.md) for the merged code.

## Problem and goal

Small-business owners must navigate separate government offices and portals without a clear explanation of which requirements apply, which tasks depend on others, and which dates are confirmed. A generic checklist does not account for their legal form, activities, premises, employees, or business stage.

Hermit's goal is to turn those answers into an understandable, sourced roadmap and help the owner track the work. It provides researched guidance with visible coverage limits, not a guarantee that every legal obligation has been identified or fulfilled.

## Audience and product boundaries

The primary audience is small-business owners operating in the **City of Manila**, including owners with limited time or digital familiarity. One account can manage multiple businesses, each with its own profile and progress.

The product is an English-language, mobile-friendly website/PWA. National registration guidance is included where relevant to Manila businesses. Other LGUs are outside this MVP. Intake choices, supported journeys, and exact exclusions are defined in [Scope](SCOPE.md#approved-coverage).

The project is for CSSprint 2026. The team must understand and explain its implementation. The supplied competition constraints are recorded in [Sources](SOURCES.md#hackathon-context); exact handbook dates have not been independently verified here.

## Owner journey

| Step | Owner outcome |
| --- | --- |
| Sign in | Use eGov SSO or Hermit's email/password account. Link methods explicitly when desired. |
| Choose a business | Create or select a business; see its own saved information. |
| Describe it | Enter legal form, multiple activities, separate professional/freelancer status, Manila location, premises, employees, and journey. |
| Clarify | Answer relevant follow-up questions, including an explicit “I'm not sure” option. Review and edit answers. |
| Review the roadmap | Understand what applies, why, what to prepare, prerequisites, and the issuing office or official portal. See source and review information. |
| Track the work | Record one of four progress statuses, notes, and document dates manually. |
| Return to the dashboard | Find the next action, blocked tasks, submissions awaiting completion, and upcoming confirmed dates. |
| Get help or export | Ask the sourced AI assistant about the selected roadmap, optionally dictate the question, or export eligible dates to a calendar file. |

Opening, renewal, supported updates, and closure use this shared journey. Changing a journey does not certify registration, renewal, or legal closure.

## Required capabilities

### Sourced guidance and progress

The roadmap uses deterministic reviewed rules, not AI decisions. Multiple activities add relevant tasks without duplicating shared work. Unknown answers prompt clarification or a visible confirmation notice.

Each published requirement explains its applicability, prerequisites, preparation, issuing office, submission channel, official source, effective-date information, and review date. Include fees, processing times, and deadlines only where reviewed official material supports them. Missing information stays visibly unconfirmed.

Owners record **not started, preparing, submitted, or completed**. Only completed prerequisites satisfy dependencies. Blocked readiness and expiry indicators remain separate from progress status. Counts describe tracked work, not a legal compliance score.

### Accounts and persistence

Supabase Postgres is the authoritative store for business profiles, roadmaps and versions, task progress, notes, and dates. Multiple businesses remain isolated within the account, and one account cannot access another account's data. Switching businesses also switches dashboard, assistant, and calendar context.

Both approved sign-in methods lead to the same businesses after explicit authenticated linking. Ordinary SSO or email login must not be labelled National-ID-verified. Separate eVerify is deferred.

### Dates and offline reading

The dashboard distinguishes document expiry, filing deadlines, and preparation dates. Export only dates supported by reviewed applicable rules or explicitly confirmed by the owner. Historical deadline extensions must not be reused for later years.

Provide `.ics` download for manual calendar import, without automatic recurrence or direct calendar-account synchronization. After successful online loading and caching, the owner can read the last saved roadmap and progress offline. Editing, sign-in, AI, voice input, and government pages require connectivity. Signing out clears cached personal data.

### AI and voice

The English-only assistant explains the selected business's roadmap using the reviewed library, relevant profile/task context, citations, and review dates. It acknowledges gaps rather than supplying unsupported guidance. It cannot change applicability, progress, dates, or records. Conversation history is transient.

AssemblyAI speech-to-text is available **inside AI chat only**. The owner starts and stops recording, edits the transcript, and explicitly sends the question. Hermit does not retain audio recordings; provider processing and retention must be disclosed accurately.

### Navigation and appearance

Use the approved [pale-blue design philosophy](DESIGN-PHILOSOPHY.md), a desktop sidebar, and compact mobile navigation. Include Office Locator in navigation with its page empty for now. Task-level issuing-office details remain part of roadmap guidance.

## Success criteria

An owner can sign in, select a business, complete intake, understand the next action and its source, record progress, return to the saved data, and export a confirmed upcoming date.

The demo must also establish:

1. Different legal forms select the appropriate reviewed registration paths.
2. Multiple activities combine requirements without duplicate shared tasks.
3. Unknown and unsupported cases remain visible.
4. Completing a prerequisite unblocks dependents; submitting it does not.
5. Data stays separate across businesses and accounts.
6. Progress survives refresh, sign-out/sign-in, and reopening with the same account.
7. Offline reading uses the last saved snapshot and does not permit edits.
8. Calendar export rejects unconfirmed dates and invalid year/extension reuse.
9. AI answers cite reviewed sources and voice transcription is editable before sending.
10. Opening, renewal, updating, and closure do not silently reuse an inappropriate journey or old-period completion.

Detailed acceptance scenarios are in the [specification](SPECIFICATION.md#acceptance-scenarios). Passing the prototype's existing tests alone does not satisfy these criteria.
