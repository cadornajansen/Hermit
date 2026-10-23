# HERMIT

### The paperwork shouldn't be harder than the business.

**Your business, remembered. Your next step, explained.**

Opening a small business takes courage. Figuring out which permit comes first, which form belongs to which office, and when a tax filing is due should not take another career. Yet for many Filipino micro, small, and medium enterprise (MSME) owners, that is what compliance feels like: a trail of unfamiliar acronyms, repeated information, separate websites, and long trips to ask one question.

**Hermit is a friendly home base for that journey.** It helps an owner understand what may apply to their business, prepare the paperwork, find the right government channel, and keep track of what they have already done. The first pilot focuses on businesses in the **City of Manila**.

> From **“Saan ako magsisimula?”** to **“Alam ko na ang next step.”**

## Why we're building Hermit

A sari-sari store, a carinderia, and a growing online shop do not all follow the same path. Their requirements can change with their location, activities, business structure, employees, and stage of growth. The owner is often left to piece that path together alone.

Hermit has five goals:

1. **Make the process understandable.** Explain each step in ordinary language, including why it matters and where it happens.
2. **Give every owner a clear next move.** Show what to prepare now, what depends on an earlier step, and what still needs confirmation.
3. **Reduce repetition.** Help carry reviewed business details into forms instead of asking the owner to start from a blank page every time.
4. **Keep the journey in one place.** Bring requirements, documents, forms, dates, and progress into one workspace.
5. **Bring government services closer.** Use eGov connections where available and guide owners to the right official agency channel for the rest.

The aim is simple: give owners more time and confidence to build their businesses, with less energy lost to paperwork and uncertainty.

## How it works

### 1. Tell Hermit about your business

The owner answers guided questions: What do you do? Where is the business? Are you just starting, already operating, hiring, or renewing? If an answer is uncertain, the owner can say so and return to it later.

### 2. Get a roadmap that makes sense

Hermit turns those answers into a checklist of steps that may apply. Each step shows what it is for, what comes before it, what to prepare, and which office or official portal to use. The dashboard keeps the next action in view, while the owner records progress as work gets done.

### 3. Ask Kuya Hermit

When a form or requirement sounds intimidating, the owner can ask Kuya Hermit to explain it. The assistant uses the business's roadmap and the information available in Hermit to give a plainer answer, with source links where available. It helps the owner understand the path; the owner makes the final business and filing decisions.

### 4. Prepare once, review every time

Hermit brings together a form library, editable answers, available official blank forms, and a document vault. Known details can help fill a form, but the owner reviews and changes them before using it. Saving answers for future forms is optional and requires a separate choice. Documents and important dates stay easy to find when it is time to renew or follow up.

### 5. Reach the right government channel

Hermit points to the appropriate government service, agency website, or office for the task. The owner can also see payment and filing flows in the prototype, then return to Hermit to keep track of the work. The goal is a journey that feels connected even when several agencies are involved.

## What eGov makes possible

**eGov powers Hermit's connections to Philippine digital government services.** With access to the relevant services, an owner can sign in through eGovPH, complete a separate identity check through eVerify, use eGovPay for a payment flow, receive eMessage reminders, or report red tape through eReport. Hermit also uses eGov AI where configured to help with business descriptions and document reading.

These connections are the foundation for a more joined-up experience. Hermit can help an owner prepare for tasks involving agencies such as **DTI, BIR, SEC, CDA, local government offices, SSS, PhilHealth, and Pag-IBIG**, then direct them to the official channel that handles each task.

**Where the prototype stands:** eGov connections depend on service access and configuration; the payment flow uses test mode. Hermit's in-app filing and status timeline are demonstrations. Applications and tax returns still need to be submitted through the relevant agency's official channel. The longer-term goal is to connect actual submission and status services as access becomes available.

## Picture the owner journey

Imagine someone opening a small food business in Manila. They tell Hermit what they plan to sell and whether they will hire staff. Their roadmap shows the registration and permit steps that may apply, the documents to prepare, and the next office or portal to visit. When a question on a form is unclear, they ask Kuya Hermit. When they receive a document, they keep it in the vault and record its date. When they return next week, Hermit remembers where they left off.

That is the experience we want to build: **less searching, less second-guessing, and a clear next step every time.**

## Try Hermit

```bash
pnpm install
pnpm dev
```

Open [Hermit locally](http://localhost:3000) or go straight to the [guided onboarding](http://localhost:3000/onboarding). The landing page and local onboarding can be explored without connected services. A [sample business](http://localhost:3000/demo) is available when the project database is configured; it currently uses a fictional Taguig business from an earlier demo, while new onboarding is Manila-only.

For service setup and implementation details, see [`.env.example`](.env.example) and the [implementation notes](docs/IMPLEMENTATION.md). The [product requirements](docs/PRD.md) and [source policy](docs/SOURCES.md) explain the intended scope and how guidance must be reviewed.

## A promise to owners

Hermit is here to help people understand and organize their responsibilities. Its current requirements, fees, and dates still need review against official sources for the Manila pilot. Owners should confirm guidance with the issuing office before filing or paying. Progress in Hermit records the owner's work; it does not certify legal compliance.

**Less paperwork panic. More time to build the business.**

## Office finder setup

**Office finder:** choose a document/service and confirm the business jurisdiction before comparing offices.
Only active, current registry records with evidence of that exact service and area coverage are eligible.
The maintained registry (`lib/office-registry.ts`) now has source-reviewed Manila permit handlers and
selected NCR registration destinations. Public counter details and coordinates still need independent
review. Legacy Taguig seeds remain labelled unverified. The assistant and packet
branch lookup use the same resolver. Requirement details link directly to the relevant office search.

The approved provider is Google only: Maps JavaScript for display, server-side Geocoding for an explicitly
submitted starting address, and external Google Maps directions links. No Places discovery or Routes calls
are made. Device location is requested on demand, denial preserves the choice, and address matches require
confirmation. Distances say “Approximate straight-line distance”; missing/stale coordinates stay unranked.
The map and selected office list synchronize, with the scrollable list on the right on desktop and below
the map on small screens. Textual results remain available when the map fails.

Live map/address features default off (`OFFICE_FINDER_ENABLED=false`). A separate `OFFICE_FINDER_DEMO=true`
setting adds synthetic offices and coordinates in local development only; production builds ignore it.
Before enabling public rollout, confirm the seeded office counters and service rules, supply independently
reviewed coordinates, restricted Google browser/server keys and a production map ID, publish appropriate
terms/privacy disclosures, and configure provider-side quotas. Geocoding also requires the existing Supabase
`take_ai_quota` RPC: each upstream attempt reserves owner/IP/project quota and fails closed if unavailable.
The default rolling project cap is 250 geocodes/day (`GOOGLE_MAPS_GEOCODE_DAILY_LIMIT`); browser map loads
need separate Google Cloud limits. Precise origins and entered addresses are transient and are not cached
server-side or saved to the business profile. No billing/resources are enabled by this code.
See [office finder setup and future staggered scaling](docs/office-finder-plan.md) and the
[Manila office seed, source links and demo limits](docs/office-seed-manila.md).
