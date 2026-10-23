# Current implementation after the main/early-phase merge

This document describes the code on `feat/early-phase` after merging local `main`. It is an
implementation inventory, not a claim that legal guidance, government integrations, or the
[target MVP](PRD.md) have passed acceptance review. The older baseline table in
[Scope](SCOPE.md#historical-implementation-inventory) records commit `10426a1` before this merge.

## What owners can use now

| Area | Current behavior |
| --- | --- |
| Public entry and navigation | Main's landing page, visual system, account screens, responsive workspace shell, search, and navigation are present. The sidebar includes Dashboard, Roadmap, Calendar, Documents, Forms, Payments, Office Locator, Ask Hermit, and Profile. |
| Onboarding | Main's seven-step visual wizard captures multiple activities, registration, location, operations, conditional details, existing documents, and review. A City of Manila check prevents completing intake for another city. Older out-of-city profile values remain stored and must be updated before resubmitting onboarding. |
| Roadmap and dashboard | The shared rule engine combines activity branches and avoids duplicate shared requirements. Main's dashboard and roadmap presentation uses early-phase requirement data, statuses, forms, and owner state. Rules and source claims still require official review. |
| Accounts | Supabase email/password registration and sign-in coexist with anonymous owner cookies and eGovPH SSO. Email accounts use the Supabase user ID; anonymous/eGov sessions use a separate owner ID. Switching sign-in methods does not transfer business data, and explicit linking is not implemented. The active owner controls both server operations and device snapshot visibility. |
| Existing early-phase tools | Document vault, editable field sheets and PDFs, packets, payments, calendar, office locator, eGov adapters, and Kuya Hermit remain available through the workspace. Their configured/live behavior depends on service credentials and their own evidence limits. |
| Persistence | A device working copy is stored per owner; server actions scope Supabase rows to the currently resolved owner. Pending changes survive reload and retry when the backend is available. Reusable form answers remain device-local and require explicit consent. Current form edits and signatures remain session-only. |

## Scope boundaries and gaps

- Manila is the current intake jurisdiction. The repository still contains nationwide location data,
  legacy Taguig office/form data, and other-LGU guards for existing records. Their presence does not
  reopen nationwide onboarding.
- Email and eGov accounts stay separate. No automatic linking, migration, or cross-account data copy
  occurs. A matching name or email address is not an ownership check.
- The current store holds one active business profile per owner. The target multiple-business selector,
  explicit account linking, confirmed-date `.ics` export, read-only offline app cache, and AssemblyAI
  microphone input are not delivered by this merge.
- The existing assistant, vault, payments, reminders, and office data go beyond some deferred target
  features. They remain available; target approval and production readiness should be assessed against
  [Scope](SCOPE.md) and the [source policy](SOURCES.md).
- Supabase and government adapters can run without live credentials in local development. Passing tests
  does not prove live SSO, payment, AI, maps, or legal-content accuracy.

## Local setup and verification

Use the repository [README](../README.md) and [`.env.example`](../.env.example) for setup. The merged
dependency lockfile uses Next.js 16.4.2. After integration, the full 117-test suite, TypeScript check,
ESLint, and production build passed. The tests exercise account separation, stale-owner write rejection,
sync retries, requirement logic, forms, packets, and other early-phase behavior with mocked external
boundaries. There was no live-service or browser visual acceptance test in this merge.
