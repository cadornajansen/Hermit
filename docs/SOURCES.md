# Hermit — Sources and review policy

This register distinguishes product decisions, implementation evidence and official research. A reference link is not proof that every claim associated with it is current or verified.

## Product and design provenance

| Reference | Role and authority |
| --- | --- |
| Explicit owner decisions in the project conversation, recorded 22 October 2026 | Authority for the approved target captured in [Scope](SCOPE.md). Later explicit decisions supersede earlier assumptions. |
| [HERMIT Google Doc](https://docs.google.com/document/d/1jVlMLZHIiTnIJCEZxbl8SKpsHGFOzMFUsXYYVp6mOAM/edit?tab=t.0) | Broader product proposal and research leads. Read during planning; its additional features, legal claims, deadlines and instructions are not automatically approved. The source document is not modified here. |
| [Owner-supplied screenshot](references/blue-design-reference.png) | Visual reference for pale-blue atmosphere, spacing and contrast. Preserved unchanged; it is not an approval to reuse the depicted artwork or branding. |
| [Repository](https://github.com/cadornajansen/Hermit), inspected commit `10426a1` | Evidence of current code behavior, not evidence of legal correctness or live government readiness. |

Key superseded assumptions: the new `asikaso` location, static-export-only hosting, browser-only storage, one business, no accounts, no AI, and the earlier three-journey limit. The existing Hermit repository, runtime backend, Supabase, multiple businesses, bounded AI/voice and closure now govern the target.

## Official technical references

These support implementation planning, not business-compliance advice. Recheck relevant current documentation before changing integrations. Follow the repository's [AGENTS instructions](../AGENTS.md) and bundled version-specific Next.js documentation when implementing Next.js behavior.

| Topic | Official reference | What it supports / limit |
| --- | --- | --- |
| Next.js runtime endpoints | [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) | Server request handling within the chosen framework. |
| Earlier hosting constraint | [Static exports](https://nextjs.org/docs/app/guides/static-exports) | Explains the original export mode; static-export-only hosting was subsequently superseded. |
| PWA | [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) | Manifest and application capabilities; a manifest alone does not establish offline caching. |
| Styling | [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs) | Official styling integration reference. |
| Components | [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) | Locally owned component setup; existing project already uses shadcn. |
| Hermit account login | [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords) | Email/password account flows; email confirmation is not National ID verification. |
| Ownership | [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | Database-level row access rules, used with appropriate grants and authenticated ownership. |
| Linking methods | [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) | Linking capabilities and restrictions. Does not prove eGov fits a particular provider type or linking API. |
| External providers | [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers) | Standards-based provider integration. eGov's documented contract must be checked separately; no built-in eGov provider is assumed. |
| eGov sign-in | [Official eGov SSO guide](https://platforms.e.gov.ph/api-catalogs/egov-sso) | Server-side sign-in exchange and consented account identity. No National-ID-verification assurance is assumed. |
| Government access | [Official platform FAQs](https://platforms.e.gov.ph/faqs) | Access/onboarding and sandbox information; approval and production permission for this team remain unverified. |
| Deferred National ID service | [Official eVerify guide](https://platforms.e.gov.ph/api-catalogs/everify) | Separate verification capability; not an approved MVP integration. |
| Voice transcription | [AssemblyAI browser streaming](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio), [temporary authentication tokens](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token) | Server-protected API credentials and browser transcription. Provider retention settings require separate verification. |

The existing [egov.js adapter](../lib/egov/live.ts) is implementation evidence using a community SDK. Adapter presence or credential-variable names do not establish that the official contract is correct or production access is available. Mock results must stay distinguishable from live results.

## Requirements publication gate

The current [requirements library](../lib/engine.ts) contains **27 unreviewed seed records**, each with `lastVerified: null` at the inspected baseline. This documentation does not approve those records or copy their fees, procedures or deadlines into a verified Manila library. Other-LGU references and generic agency homepages are research leads, not sufficient evidence of Manila-specific applicability.

Before publishing any requirement as supported guidance:

1. Find official agency or City of Manila material supporting the actual procedure and applicable business/journey, not just the agency's existence.
2. Record exact official URL(s), what each establishes, jurisdiction, legal-form/activity conditions, prerequisites, preparation and submission channel.
3. Record the actual review date, reviewer/team responsibility, effective-date information and valid deadline period. “Not stated” is allowed when the source supplies no effective date. A documentation date must not be substituted for a legal effective date.
4. Include fees, processing times and deadlines only when supported by the reviewed material. Label gaps and conflicting guidance for confirmation.
5. Mark historical extensions with their explicit year/period. Confirm any recurring-rule derivation or holiday/weekend adjustment independently; do not extrapolate an extension.
6. Test matching and date eligibility, then publish a new reviewed library version. Retain a visible coverage notice for unsupported cases.

Every published requirement needs an official source and a review date. Partial coverage remains visible even after saving a profile or completing all tracked tasks. AI answers must use the reviewed publication set, not turn research seeds or general model knowledge into legal guidance.

No business-compliance source curation, agency sign-off or live government integration testing was performed as part of this documentation checkpoint.

## Hackathon context

The owner supplied CSSprint 2026 constraints: build and conceptualize during the competition period; explain and defend the implementation; acknowledge allowed libraries, templates, datasets and AI assistance; avoid an information-only site or unnecessary AI.

The earlier handbook location, `/workspace/scratch/672a93a7aa52/upload/CSSprint2026_Participant_Handbook.pdf`, was unavailable in this Windows environment during planning. The exact competition dates, submission checkpoints, licensing acknowledgments and eligibility of the existing work still need verification against the handbook when available. Do not invent those dates or infer eligibility from Git history alone.

## Updating this register

Keep product approvals separate from source reviews and integration tests. When a code checkpoint is completed, update the implementation inventory with its commit and checks. When guidance is researched, record its own evidence and review date. When official material conflicts or is unavailable, preserve uncertainty instead of describing the roadmap as exhaustive.

## Landing page agency logos

Retrieved **22 October 2026** from the official agency websites below. The local PNG files retain the downloaded artwork, colors and proportions. Their presence identifies government offices referenced by Hermit's roadmap; it does not claim agency partnership, endorsement, approval or a live integration. This register records provenance and does not assert a license grant.

| Agency | Local asset | Dimensions | Official source page | Direct asset source |
| --- | --- | --- | --- | --- |
| Department of Trade and Industry (DTI) | [dti.png](../public/brand/agencies/dti.png) | 137 × 128 | [DTI Business Name Registration System](https://bnrs.dti.gov.ph/) | [Official PNG](https://bnrs.dti.gov.ph/templates/logo.png) |
| Bureau of Internal Revenue (BIR) | [bir.png](../public/brand/agencies/bir.png) | 1250 × 226 | [BIR homepage](https://www.bir.gov.ph/home) | [Official CDN PNG](https://bir-cdn.bir.gov.ph/BIR/uploads/489765a4-a81c-4654-ac53-95457bba503d.png?t=1723772969748) |
| Securities and Exchange Commission (SEC) | [sec.png](../public/brand/agencies/sec.png) | 367 × 238 | [SEC eWATCH login](https://ewatch.sec.gov.ph/login) | [Official PNG](https://ewatch.sec.gov.ph/images/sec-logo.png) |
| Cooperative Development Authority (CDA) | [cda.png](../public/brand/agencies/cda.png) | 2246 × 2246 | [CDA: About our logo](https://cda.gov.ph/about-us/about-our-logo/) | [Official PNG](https://cda.gov.ph/wp-content/uploads/2021/01/CDA-logo-RA11364-PNG.png) |

The BIR artwork includes a wide black wordmark on a transparent canvas; display the entire asset against a light background. Logos must not be stretched, recolored or presented as a compliance-verification badge. These visual references do not change the requirements publication gate above.
