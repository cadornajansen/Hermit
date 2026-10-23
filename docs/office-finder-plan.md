# Office finder: proposal and provider decision

Status: **draft for owner review; no provider selected and no implementation approved by this document**.
Checked 23 October 2026 against `testing-feature-implementation` at
`b554543e5d95e522b624204e81d57b6b56196f77`. The working tree was clean before this documentation work.

## Purpose and approval boundary

An owner chooses the document or service they need, confirms the business area it applies to,
and sees offices verified to handle it. A chosen starting location determines proximity, not
which office has jurisdiction. Selecting a result updates its map and list selection.

No finalized office-finder plan was found in the checkout or the supplied support directory.
The supplied `gpt-office-finder-implementation-plan-prompt.md` explicitly asks for planning only;
`gpt-office-finder-implementation-prompt.md` is also an instruction document, not an approved plan.
The prior research recommends OSM but labels its implementation phases as proposals for later
approval. No explicit provider decision appears in the available conversation. Accordingly,
this checkpoint records findings, proposed behavior, and costs; application implementation must wait.

Inputs inspected in `/home/kampfer-archive/Documents/AI Accessible Files/hermit_support/`:

- `gpt-office-finder-implementation-plan-prompt.md`.
- `office-maps-integration-research.md`, checked 22 October 2026 at `ea4d390`.
- `office-google-maps-api-audit.md`, checked 23 October 2026 at `b554543`.

The existing [scope](SCOPE.md:35) describes an empty Office Locator and Manila coverage;
the [implementation inventory](IMPLEMENTATION.md:20) distinguishes that target from legacy Taguig
records. The current request authorizes preparing this feature proposal, but neither earlier
Taguig research nor the existing Google integration establishes provider approval or new city coverage.

## Current checkout findings

These are source findings, not a production database or live-provider audit. References are to this
checkpoint's baseline; implementation must recheck them after subsequent changes.

| Area | Evidence and consequence |
| --- | --- |
| Runtime | [package.json](../package.json:27) and installed `node_modules/next/package.json:3` both identify Next.js 16.4.2. React is 19.3.0. Read installed App Router guides before code changes. The server/client-boundary and environment-variable guides were inspected for this proposal. |
| Service selection | [Requirement](../lib/types.ts:73) has stable IDs and broad office types. [buildChecklist](../lib/engine.ts:576) retains possibly applicable requirements. The current [office screen](../app/(app)/offices/page.tsx:20) collects all checklist office types rather than asking for one service. |
| Office records | [Office](../lib/types.ts:126) contains type, name, note, and optional URL. The [13 Taguig seeds](../lib/offices.ts:8) mix physical and online services and lack verified coordinates, addresses, branch IDs, and machine-readable service coverage. |
| Eligibility | [officesFor](../lib/offices.ts:27) filters by office type and pilot city, with a generated barangay-hall label. [Places filtering](../app/maps.ts:100) checks names and business status; it does not prove exact service or jurisdiction eligibility. |
| Area identity | [resolveLocation](../lib/locations.ts:62) distinguishes cities using province/region and returns stable city codes. Barangay remains free text; do not infer a verified barangay jurisdiction from a name match. |
| Provider requests | [app/maps.ts](../app/maps.ts:31) accepts the first geocode, then makes one Places Text Search request per supported office type at [line 91](../app/maps.ts:91). Its [field mask](../app/maps.ts:11) requests Pro-tier Places fields. |
| Retention and limits | The [server cache](../app/maps.ts:24) retains addresses/origins and provider results without eviction. The [quota helper](../lib/ratelimit.ts:34) permits requests without a database, while one check covers multiple provider calls. |
| Origin and retry | [lastWhere](../app/(app)/offices/page.tsx:80) starts as null; [Retry](../app/(app)/offices/page.tsx:124) can therefore change a failed location attempt into a profile-address search. Device accuracy and position age are not presented. |
| Map/list | The [map precedes the list](../app/(app)/offices/page.tsx:127), without the requested desktop split. A [loader failure](../components/office-map.tsx:97) is logged without a visible fallback. [Distance text](../app/(app)/offices/page.tsx:146) lacks the straight-line qualification. |
| Shared guidance | The assistant's [get_offices](../lib/hermit.ts:295) uses the same broad selector. [Process guidance](../lib/processes.ts:37) has prose office descriptions, not verified branch assignments. Consumers must share the future resolver. |
| Privacy/configuration | [Profile](../lib/types.ts:32) contains declared addresses; [store persistence](../lib/store.ts:115) and [owner sync](../app/sync.ts:91) make it unsuitable for transient live coordinates. [.env.example](../.env.example:54) already documents separate Google server/browser keys; their existence is not consent to use Google. |
| Tests | [maps.test.ts](../lib/maps.test.ts:18) checks cache behavior, failure distinctions, and UI messages with mocked boundaries. These tests do not establish verified service eligibility, safe denial retries, or map-load recovery. |

## Provider decision brief

Recommendation for review: OSM data with MapLibre rendering, OpenFreeMap tiles, a curated Hermit
office registry, and local straight-line ranking. Manual address search needs an explicitly accepted
geocoder. Geoapify is proposed as a hosted OSM-based geocoder because public Nominatim is unsuitable
for private address input. Self-hosted regional Nominatim is the alternative when avoiding that vendor
is worth operating a geocoder. Neither supplies authoritative government-office eligibility.

The following prices/policies were checked in official documentation on 23 October 2026.
USD prices exclude taxes, existing app/database costs, and office-verification labor.

| Choice | Tiles and rendering | Address search | Routing and costs |
| --- | --- | --- | --- |
| OSM, hosted pilot | MapLibre GL JS plus OpenFreeMap vector tiles. Public tiles advertise no request/view fees or key requirement, but are provided as-is and may be discontinued. | Geoapify Geocoding: Free has 3,000 credits/day and 5 requests/second; simple geocoding generally costs one credit. The next plan is $59/month for 10,000 credits/day. Free use requires attribution. | Local Haversine ranking; zero routing API calls. An explicit external directions action is proposed. No automatic paid upgrade. |
| OSM, self-hosted geocoder | Same renderer/tiles; self-hosting tiles is separately possible. | Regional Nominatim on dedicated infrastructure; software has no per-call license fee. Import, updates, storage, monitoring, and backups are Hermit's responsibility. | Same local ranking and external handoff. Geocoder allowance: $40–150/month plus labor; this is an unmeasured engineering estimate, not a vendor quotation. |
| Google managed services | Maps JavaScript API: Dynamic Maps, 10,000 free monthly loads, then $7/1,000 in the first paid tier. | Geocoding API: 10,000 free monthly requests, then $5/1,000 in the first paid tier. Billing and credentials are required even below allowances. | Same local ranking; Google Maps URLs for external directions. Places and Routes are unnecessary for the proposed registry-based flow and would not be enabled. |

Sources: [Google global prices](https://developers.google.com/maps/billing-and-pricing/pricing),
[JavaScript billing requirement](https://developers.google.com/maps/documentation/javascript/usage-and-billing),
[Geocoding billing requirement](https://developers.google.com/maps/documentation/geocoding/usage-and-billing),
[OpenFreeMap service](https://openfreemap.org/), [OpenFreeMap terms](https://openfreemap.org/tos/),
[integration and attribution](https://openfreemap.org/quick_start/),
[Geoapify prices](https://www.geoapify.com/pricing/),
[Geoapify terms](https://www.geoapify.com/terms-and-conditions/), and
[Nominatim infrastructure requirements](https://nominatim.org/release-docs/latest/admin/Installation/).

Cost examples are assumptions, not measured traffic. For Google, assuming one map load per session,
one geocode per manual search, no other account usage, and volumes below 100,000 per SKU:

- 1,000 map loads and 1,000 geocodes/month: $0 usage charges; billing still required.
- 20,000 map loads and 20,000 geocodes/month: `(10,000 × $7 + 10,000 × $5) / 1,000 = $120`.
- 20,000 map loads and 2,000 geocodes/month: $70. Device-only origins require no geocode.

The existing Places flow has additional exposure: 1,000 uncached searches across six types yield
6,000 Text Search Pro requests; after its 5,000-event allowance, the first-tier estimate is $32.
Registry lookup eliminates this discovery fan-out. See [Places pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

For the hosted OSM proposal, the same example can stay within the free geocoder allowance **only if
daily peaks and account-wide rate limits also fit**. A monthly total cannot prove this. Geoapify's
pricing FAQ describes soft limits; its terms reserve suspension or overage charges, so enforce a
lower application cap rather than relying on vendor cutoff. No account plan or paid upgrade is approved.

Self-hosted tiles could add an estimated $5–30/month at low regional traffic, excluding bandwidth
growth/import labor; this is not needed for the proposed public-tile pilot. No hosted routing service
is proposed. If later approved, self-hosted regional OSRM could add an estimated $20–100/month plus
graph updates and operations. Neither estimate is a measured deployment size; do not use the public
OSRM demo as production capacity. See [OSRM deployment](https://github.com/Project-OSRM/osrm-backend)
and [demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy).

Public OSM services are distinct from OSM data. Public Nominatim requires at most one request/second
across the application, identification, attribution, and caching; prohibits autocomplete and personal
or confidential input; and places additional restrictions on generic generated integrations. It is
excluded from runtime address search here. OSMF raster tiles are best effort, with attribution,
caching, and no bulk-prefetch requirements; they are not an unlimited fallback tile backend.
See [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) and
[OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/).

### Requested clarification: OSM first, Google fallback

The owner asked whether the hosted OSM option could be tried first, with Google as a second layer
when information is sparse. This is a feasibility question, **not provider or billing approval**.

A staged address-search fallback is technically possible, but it would revise the single-provider
pilot proposal. An explicit “Try Google” action could send the entered address to Google after
an ambiguous or unsuccessful Geoapify search. Under the inspected non-EEA service terms, Google
Geocoding and ordinary Places API content cannot be used with a non-Google map. Any corresponding
mapped fallback must switch to a Google map and retain Google's attribution and data restrictions;
it cannot simply add Google-derived pins to OpenFreeMap. See [service-specific terms, sections 6 and 14](https://cloud.google.com/maps-platform/terms/maps-service-terms)
and [Places display policies](https://developers.google.com/maps/documentation/places/web-service/policies).

Sparse eligible-office results require better verified office/service-area records. Google Places
can discover candidates for curator review, but cannot establish eligibility or automatically fill
the confirmed list. Tile-map detail, address matching, and office capability coverage are separate
failure types; each needs its own response. A tile failure can retain the textual list without a
geocoding call. A geocoder quota failure must not silently bypass the accepted budget using Google.

The cheaper proposed Google handoff is an explicit external Maps search/directions link, which
needs no Hermit API key; results stay in Google and are not imported as confirmed Hermit offices.
See [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
An embedded fallback would require separate acceptance of Google billing, disclosure of address
transmission, per-provider accounting, a strict retry/cost cap, Google key setup, and additional tests.
Those choices remain open; no fallback service has been enabled or implemented.

## Proposed behavior independent of provider

1. Choose or confirm an exact requirement/service, preserving “possibly required” status. Link task
   handoffs to `/offices?requirement=<id>`; validate the ID and never accept it as eligibility evidence.
2. Confirm the business jurisdiction using the existing location resolver. Request missing area or
   assigned-branch facts when needed. Device location and a travel starting address never overwrite it.
3. Resolve active offices with independently verified service capability **and** service-area or
   assignment coverage. Unknown coverage means unknown, never nationwide. A branch outside the city
   may qualify only with evidence that it serves the selected area. Show why each office qualifies.
4. Show eligible textual results before asking for location. Offer device location or submitted city,
   barangay, or address search. Preserve the declared origin and permission outcome; use a saved
   business address only through an explicit, clearly labelled action.
5. Rank only eligible offices with current verified physical coordinates, using Haversine distance.
   Label every distance “Approximate straight-line distance.” Break equal values by stable office ID;
   do not claim a unique nearest office where accuracy or missing mapped branches makes that uncertain.
6. Show the map left and a bounded, scrollable result list right on desktop; stack on small screens.
   Keep selection visible and keyboard-operable, announce updates, and frame the origin and selected
   office. Update the existing map instead of recreating it on selection or every search.
7. Keep online-only services as official portal actions. Preserve existing eReport and unrelated
   workflows. External directions identify a verified destination and omit precise origin by default;
   label the destination service and let it request its own origin. No driving distance or ETA is inferred.

| Failure or incomplete state | Required response |
| --- | --- |
| Denied/unsupported/timed-out location | Keep the chosen service and jurisdiction; reveal manual search. Retry never switches origin and denial never triggers an automatic browser permission retry. |
| Stale/inaccurate device position | Show age/accuracy and request an explicit refresh or manual origin; avoid a precise winner where uncertainty overlaps. |
| Ambiguous/approximate origin geocode | Show candidate locality and precision; require confirmation. A city/barangay centroid must say “area center,” not “your location.” Zero matches preserves editable input. |
| Missing/approximate/stale office coordinate | Keep independently eligible records in an unranked “location needs verification” section. No guessed pin or distance. Display mapped/missing counts. |
| Missing/stale service or coverage evidence | Exclude from confirmed eligible results; explain unavailable verification and offer official agency contact. Do not fill with Places results. |
| No verified eligible records | Say coverage is unavailable for this service/area. Do not claim there are no real offices or geocode invented records. |
| Provider 429, timeout, malformed or partial response | Preserve prior confirmed origin/list with clear stale-status wording; provide bounded manual retry and cooldown. Never silently select another candidate or provider. |
| Map script, WebGL, style or tile failure | Show a visible map error/retry while the complete accessible list and official actions remain usable. |

## Data ownership and architecture proposal

Start with a versioned office registry beside `lib/offices.ts`, a pure shared eligibility resolver,
and the existing `lib/nearby.ts` distance utility. Reuse them in the office page and assistant;
task links carry service IDs. Keep browser map loading behind the client boundary. A small
server-only geocoding adapter in `app/maps.ts` replaces live office discovery **after provider approval**.
Do not introduce both map libraries, a spatial database, or an admin application for this pilot.

Proposed registry fields: stable ID; agency/type; physical/online/hybrid mode; active/closed status;
official URL/address; physical city code; service IDs; explicit service-area rules and branch-assignment
exceptions; and separate provenance for services, coverage, and coordinates. Each evidence record
needs source, reviewer, checked date, and review-due date. Coordinates also need source/license,
precision, and review status. Free-text barangay aliases need documented review within a city;
unresolved aliases cannot silently satisfy a coverage rule.

The owner must name a data curator. The curator checks agency/LGU directories or obtains direct branch
confirmation, records evidence, and submits reviewable registry changes. Geocoding public office
addresses supplies candidates only: inspect country/locality, ambiguity, and actual entrance before
verification. Review on relocation/service changes and, provisionally, every 90 days. Review cadence
and stale-record treatment need owner approval. Requirement verification is separate from branch review.

Backfill is blocked on real evidence. Preserve legacy data as explicitly unverified guidance; never
upgrade the 13 seeds or generated barangay labels to verified branches automatically. Manila needs
new verified records; Taguig seeds do not establish Manila coverage. Synthetic records belong in tests
only. No office-table migration is proposed for the static registry. Production geocoder quota storage
may require a new isolated database migration; decide that design after provider selection and inspect
the existing quota RPC before implementation. Do not rewrite applied migrations or reset user data.

## Privacy, limits, and environment proposal

- Keep precise origin and entered addresses only in transient component memory; clear them on owner
  change/navigation reset. Do not add them to profile, localStorage, chat, analytics, or persistent logs.
- Explain before address submission that Hermit's server and the selected geocoder process the query.
  Geoapify reports request-data retention, generally up to 24 hours for successful requests; Hermit's
  transient handling does not imply the provider stores nothing. See its [privacy policy](https://www.geoapify.com/privacy-policy/).
- Explain map-host IP/viewport exposure before loading the map. Show OSM/OpenMapTiles/OpenFreeMap
  attribution where applicable, plus Geoapify attribution alongside geocoded information. Honor
  [OSM licensing](https://www.openstreetmap.org/copyright); do not add offline tile prefetch.
- If Google is chosen, keep its geocoded content on Google maps and apply attribution and public
  terms/privacy disclosures. Prefer independently sourced office coordinates; do not permanently
  copy Google results into a shared registry or reuse them on OSM. See [geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies)
  and [service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
- Only explicit manual submission sends an origin geocode: one upstream request per attempt, no
  autocomplete, POI fan-out, routing calls, or automatic retries. Validate finite coordinate ranges,
  query length, country and response schema; cancel/ignore superseded responses.
- Reserve quota atomically before **each** upstream attempt, including failed attempts, across server
  instances. Proposed pilot limits: 15/hour and 40/day per owner, 150/hour per hashed IP, and for the
  Geoapify Free proposal 2,500/day plus 4 requests/second account-wide, reduced by other account use.
  Fail closed if the shared limiter is missing or unavailable, including when live keys exist locally;
  explicitly mocked tests need no provider access. Return a safe retry time. These are proposed app
  limits, not vendor entitlements. Google browser map loads additionally need provider-side quotas
  and monitoring; server geocoder limits cannot control those loads. Budget alerts do not cap spend.
- No new environment variables are active in this checkpoint. After approval, update `.env.example`
  with blank values for the selected provider only: proposed `GEOAPIFY_API_KEY` and a public tile-style
  URL for hosted OSM, or a server-only Nominatim endpoint for self-hosting. A runtime feature flag and
  quota configuration must have safe defaults. Google would reuse the existing three Google variables.
  Server keys stay server-side; restrict Google browser keys by referrer/API and server keys by API
  and applicable server restrictions. Never commit secrets or enable services/billing automatically.

## Ordered implementation checkpoints after review

| Phase | Dependency and completion evidence |
| --- | --- |
| 0. Finalize decisions | Record explicit provider/geocoder and cost approval, Manila pilot coverage, curator, review cadence, quota backend, and external directions/privacy acceptance. Then finalize the provider-specific plan for review. |
| 1. Registry and resolver | Define validated records and exact-service/coverage filtering; add synthetic fixtures; integrate shared consumers. Missing production records remain honestly empty. Curator review is required before publishing eligibility. |
| 2. Origin and geocoder | Implement explicit origin/consent states, ambiguous-geocode confirmation, shared fail-closed request accounting, and no persistent origin retention. All failure tests use mocked responses. |
| 3. List and map | Implement selected-state synchronization, desktop split/mobile stack, attribution, directions, keyboard interaction, and map-load recovery with the chosen library only. |
| 4. Verification and rollout | Run focused tests, repository checks, browser/manual acceptance with synthetic network fixtures, and curator review of real office records. Update implementation/setup/privacy docs before a local Conventional Commit. |

Use a default-off runtime feature flag for staged activation. Missing credentials/quotas keep the
verified text list available and clearly disable address search/map capabilities that need them.
Record aggregate failures, quota consumption, and coverage gaps without origins/addresses. Rollback
disables the new provider behavior without reverting user records or restoring unverified eligibility
claims. Actual production activation, credentials, quotas, and provider configuration remain external work.

## Verification and acceptance

Baseline command run at this checkpoint:
`node --test lib/maps.test.ts lib/nearby.test.ts lib/locations.test.ts` — **20 passed, 0 failed**.
Provider fetches and quota boundaries were mocked by the existing tests. No live API calls, browser
location requests, credential reads, builds, schema changes, or cloud changes were made. These passing
baseline tests are not acceptance of the proposed feature. The only changes here are documentation.

Implementation must add focused checks for:

- Exact service and area/assignment eligibility before ranking; a closer ineligible office; an eligible
  branch outside the city; ambiguous city/barangay values; online-only and stale/unverified records.
- Denied/unavailable/timeout location, preserved consent/origin on retry, explicit saved-address use,
  inaccurate/stale fixes, ambiguous/approximate/failed geocoding, and superseded-response races.
- Switching selected offices by keyboard and pointer; matching selected list/map state; correct
  origin/office framing; desktop list on the right; usable narrow-screen stacking and focus behavior.
- Known-distance fixtures, ties, no-origin behavior, incomplete coordinate coverage, and visible
  approximate straight-line wording in both list and map without driving/ETA claims.
- Empty/partial/malformed provider responses; missing credentials; script/WebGL/tile failure;
  accessible textual results and useful retries throughout.
- Per-attempt accounting, shared concurrent caps, unavailable-limiter refusal, provider 429 cooldown,
  no hidden fan-out/automatic retry, no origins in persistent state/logs, and required attribution.

After code changes run the relevant focused tests, `npm test`, `npm run typecheck`, `npm run lint`,
and `npm run build`; diagnose failures and distinguish generated/environment issues from regressions.
Do not use live providers in automated or browser acceptance tests. Production readiness also needs
verified office/service-area evidence and confirmed deployment restrictions, privacy disclosures,
quotas, and provider setup; code tests alone cannot establish it.

## Decisions still needed

Provider choice remains open: hosted OSM with Geoapify, OSM with self-hosted Nominatim, or Google
with accepted billing exposure. After that choice, finalize the provider-specific implementation plan
and obtain review before coding. A named curator, verified Manila office/service-area records, and
accepted maintenance/privacy/operations assumptions remain release prerequisites. If an existing
finalized plan is supplied later, reconcile it with these checkout findings rather than treating this
draft as its replacement.
