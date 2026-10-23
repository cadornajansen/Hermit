# Office finder: Google implementation and rollout

Decision recorded 23 October 2026: the owner requested **Google Maps only**, with staggered provider
use documented for future scaling. This supersedes the earlier request for automatic free-provider
fallback. The implementation follows the reviewed service/area-first proposal; publication of verified
office records and live provider setup remain release prerequisites.

## Decision and evidence

The initial inspection found no finalized plan. The supplied planning prompt and prior research/audit
were read, and a provider decision brief was committed locally as `7aa440e`. The owner subsequently
selected Google only in the project conversation. There is no OSM, MapLibre, Geoapify, Nominatim,
Places discovery, or routing-service integration in this implementation.

Inputs read in `/home/kampfer-archive/Documents/AI Accessible Files/hermit_support/`:

- `gpt-office-finder-implementation-plan-prompt.md` — planning instructions, not itself approval.
- `office-maps-integration-research.md` — 22 October 2026 research at `ea4d390`.
- `office-google-maps-api-audit.md` — 23 October 2026 audit at `b554543`.

The checkout was re-inspected on `testing-feature-implementation` at `b554543` before the planning
commit. The previous office records had names/types/notes/URLs but no verified branch coordinates,
capabilities, or service-area evidence. Google Places name matching could not establish eligibility.
The prior cache retained addresses/provider results; a denied-location retry could switch origins;
map-load errors were invisible; and one quota check covered many Places calls. Those paths have been
replaced for the finder. The older [scope inventory](SCOPE.md#historical-implementation-inventory)
remains historical evidence, not a description of this checkpoint.

Declared and installed Next.js are 16.4.2. The installed server/client boundary, environment-variable,
Server Actions, and page/searchParams guides were read before changing Next.js code. The page awaits
the current asynchronous `searchParams` prop; Google keys stay on the appropriate side of the boundary.

## Implemented flow and files

| Area | Implementation |
| --- | --- |
| Entry and service confirmation | [office page](../app/(app)/offices/page.tsx), [finder UI](../components/office-finder.tsx), and the handoff in [requirement details](../components/requirement-details.tsx). `/offices?requirement=<id>` preselects a known requirement; the owner confirms it and the business area before results appear. |
| Registry and eligibility | [office-registry.ts](../lib/office-registry.ts) and [office-finder.ts](../lib/office-finder.ts). Active branch, exact service, current capability/coverage evidence, area match, and required agency assignment are checked before ranking. Duplicate branch identities are excluded. |
| Area identity | Reuses [locations.ts](../lib/locations.ts) for canonical city/province/region resolution. Reviewed barangay names are matched within their city, not inferred from geocoding or office-name patterns. Device position never changes jurisdiction. Search-area edits do not change the saved profile. |
| Coordinates and ranking | [nearby.ts](../lib/nearby.ts) computes Haversine distance locally over verified physical coordinates. Every displayed value says “Approximate straight-line distance.” No driving distance or ETA is claimed. Ties use stable office IDs. |
| Google address search | [server action](../app/maps.ts) and [response parser](../lib/google-geocoding.ts). One Geocoding API request per explicit attempt; no automatic retry or server cache. PH responses are validated, invalid results omitted, and partial/ambiguous/approximate results explicitly presented for confirmation. |
| Quotas | [ratelimit.ts](../lib/ratelimit.ts) uses the existing `take_ai_quota` RPC in [the original migration](../supabase/migrations/20261022112706_ai_rate_limit.sql). Each attempted upstream geocode reserves quota first, including requests that later fail. |
| Map and list | [office-map.tsx](../components/office-map.tsx) and [shared loader](../lib/google-maps-loader.ts). Explicit map-load consent; origin and selected-office markers; selection reuses the map. Desktop list is on the right and bounded/scrollable; mobile stacks. Script/auth/load failures show retry while the list remains usable. |
| Other consumers | [assistant](../lib/hermit.ts) requires an exact requirement for office lookup; [packet covers](../lib/pack.ts) use the same resolver for branch names. Requirement/process prose remains general guidance requiring agency confirmation. |

Location is optional. The owner can use a fresh device fix, enter a city/barangay/address, explicitly
search the saved business address, or continue without an origin. Denied/unavailable/stale location
does not trigger another origin or an automatic permission request. Accuracy is shown for device fixes;
similarly close offices may change order within that uncertainty. Geocoded area centers and partial
matches are approximate and require a deliberate choice. Failure leaves the previous confirmed origin
in use with explicit wording. Retry uses the last explicitly searched address and observes cooldown.

Online-only offices get portal actions, never map pins or distances. Eligible offices with missing,
approximate, stale, invalid, or unlicensed coordinates remain textual/unranked; partial coordinate
coverage is counted visibly. Missing/stale service or coverage evidence excludes a record from confirmed
eligibility. An office physically outside the business city is allowed only if its reviewed coverage
explicitly includes that area. Agency-assigned branches require the owner's confirmation from the
verified branch choices; proximity cannot establish assignment.

When coverage is missing, the UI says verified records are unavailable and links to official guidance.
It does not claim that no real offices exist or fill the list with Places suggestions. Historical
Taguig guidance and eReport remain available, clearly marked unverified. Map-name searches on those
historical records are explicitly external, unverified searches, not directions to a verified branch.

## Office data ownership and backfill

**The production registry is intentionally empty.** No seed branch was promoted to verified status,
and no office address, coordinate, capability, or jurisdiction was fabricated. The interface and
resolver are implemented; real eligible-office results depend on curated records.

The operator must name a curator and reviewer before publishing records. Maintain the versioned
registry through reviewed changes; no office table, spatial database, admin console, or office-data
migration is introduced. Required fields are defined by `OfficeRecord`:

- Stable ID, agency/type, physical/online/hybrid mode, active/closed status, and official website.
- Physical address/city where relevant, separate from the areas the office serves.
- Exact requirement/service IDs, city coverage and any reviewed barangay aliases or assignment rule.
- Separate capability and coverage evidence: HTTPS source URL, named reviewer, checked date, review due.
- Optional independently obtained WGS84 coordinates, building/entrance precision, source/license and
  coordinate evidence. Approximate coordinates are retained only as unverified data, not plotted.

Use agency/LGU records or direct branch confirmation to verify service and jurisdiction. Geocoding
an office address supplies a candidate, not evidence of eligibility or entrance precision. Review
ambiguity and locality manually. Prefer office-published coordinates, documented surveys or properly
licensed sources. Do not copy Google-derived coordinates permanently into a shared office directory.
Review relocations/service changes promptly and set explicit review-due dates; quarterly review is a
suggested operating cadence. Expired evidence fails eligibility or coordinate verification independently.

Manila remains the current intake scope. Legacy Taguig data does not establish Manila coverage, and
this feature does not reopen nationwide onboarding. Additional areas require their own reviewed records.

## Configuration and rollout

The verified textual flow is available independently of Google configuration. Live map/geocoding
capabilities default off. Update deployment settings only after the data and privacy/operations gates
are satisfied; no credentials, billing, Cloud resources, or deployments were created by this work.

| Environment variable | Purpose |
| --- | --- |
| `OFFICE_FINDER_ENABLED` | Exact value `true` enables live map/address features. Default is off. |
| `GOOGLE_MAPS_SERVER_KEY` | Server-only key restricted to Geocoding API and applicable server restrictions. Places and Routes are not needed. |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Browser key restricted to the deployed site's referrers and Maps JavaScript API. It is intentionally public; restrictions are essential. |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Production JavaScript/vector map ID for Advanced Markers. `DEMO_MAP_ID` is only a development fallback. |
| `GOOGLE_MAPS_GEOCODE_DAILY_LIMIT` | Rolling 24-hour project cap; default 250. Integer 1–10000; missing uses the default, invalid values fail closed. |
| Existing Supabase server variables and session setup | Required for the shared quota RPC and trusted owner resolution. Use the existing [setup](../README.md) and [.env.example](../.env.example). No new Supabase key or migration is required. |

The geocoder also enforces 60 attempts/minute globally, 15/hour and 40/day per owner, and 150/hour per
hashed IP when a trusted proxy supplies an IP. The common provider bucket is first in the RPC, whose
existing advisory lock serializes those calls across instances and owners. Limits use rolling windows;
failed upstream attempts still count. Missing database/session, RPC failure, or invalid quota config
prevents any provider call. A quota response offers a 60-second cooldown, not a promise of renewed quota.
Do not expose unsanitized forwarding headers from untrusted clients at deployment.

These caps cover server geocoding only. Configure **separate Google Cloud map-load and geocoding
quotas**, account-wide usage monitoring, and budget alerts; alerts do not stop charges. Other projects
on the billing account can consume the same allowances, outside Hermit's counters.

Google's inspected global first paid tier: Dynamic Maps has 10,000 free monthly loads then $7/1,000;
Geocoding has 10,000 free monthly requests then $5/1,000. Billing is required even below free allowances.
For an assumed 20,000 loads and 20,000 geocodes/month, with no other account usage, the estimate is
`(10,000 × $7 + 10,000 × $5) / 1,000 = $120` before taxes. This is a scenario, not a traffic forecast or
spending guarantee. Checked 23 October 2026: [prices](https://developers.google.com/maps/billing-and-pricing/pricing),
[map billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing), and
[geocoding billing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing).

Use a staged rollout: curate records, verify deployment restrictions and quota storage, publish the
public terms/privacy disclosures, then enable the flag for the accepted environment. Roll back live
provider use by setting the flag off; verified text results and user records remain. Do not restore
unverified eligibility claims or introduce another provider as an implicit fallback.

## Privacy and provider rules

Precise origin, candidate matches and entered addresses exist only in transient page state. They are
not added to profile synchronization, localStorage, chat, analytics, or the server's former location
cache. Owner/business-context changes remount and clear the finder state. Failed/unmounted requests
cannot update the replacement page. App errors omit provider bodies, URLs, keys, addresses and coordinates.
Operators must also redact outbound URL/query and request-body capture in proxies/APM; application
redaction does not configure infrastructure logging or Google's own retention.

Address submission discloses processing by Hermit and Google. Loading the map discloses Google receiving
IP/viewport data. Google address matches are attributed within the address panel; SDK attribution is
retained. Google-derived results are only mapped on Google. Independent office evidence is labelled
separately. Follow [geocoding attribution/display policy](https://developers.google.com/maps/documentation/geocoding/policies)
and the applicable [service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
The inspected terms assume a non-EEA billing address; verify the actual account agreement before release.

Directions open the external Google Maps service using a verified destination coordinate. Hermit
does not append the user's precise origin; the external service requests its own starting point.
[Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) need no Hermit API key.
No routing API, road-distance estimate, travel time, tile prefetch, or provider-result backfill job exists.
Publish operator-reviewed public Hermit terms/privacy pages satisfying provider requirements before
enabling production use; the inline feature disclosure and provider links are not a substitute.

## Future scaling option: staggered providers

The owner requested retaining this possibility in documentation, **not implementing it now**.
A future OSM-first stack could use MapLibre for rendering, OpenFreeMap tiles, and a deliberately chosen
hosted or self-hosted geocoder. If that geocoder returns zero matches, a bounded automatic Google
fallback could be considered with explicit disclosure and approved cost limits. Distinguish zero
matches from quota exhaustion, provider outage, and missing verified-office coverage.

That future design must have per-provider call accounting, a single-attempt fallback budget, provenance,
response-quality checks, tests, and a deliberate map switch. Ordinary Google Geocoding/Places results
cannot be added as pins to an OSM map under the inspected terms. Corresponding mapped Google results
must switch to Google presentation and attribution; retain no shared permanent Google office cache.
Sparse eligible-office coverage always requires curated data, regardless of search provider.

OpenFreeMap's public tiles advertise free use but are as-is, without guaranteed availability;
OSMF public raster tiles have separate usage/caching rules. Public Nominatim is not an unlimited
geocoding backend: application-wide limits, no autocomplete, and no personal/confidential input apply.
A self-hosted regional geocoder needs imports, updates, storage and operations; the earlier $40–150/month
allowance was an unmeasured estimate, not a quote. A hosted option such as Geoapify currently advertises
3,000 free credits/day and a $59/month next tier, with attribution and contractual limits. Recheck all
prices/terms and obtain the future deployment/cost decision before implementing that architecture.
Sources: [OpenFreeMap terms](https://openfreemap.org/tos/), [Geoapify pricing](https://www.geoapify.com/pricing/),
[Geoapify terms](https://www.geoapify.com/terms-and-conditions/), [public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/),
[OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), and
[Google restrictions](https://cloud.google.com/maps-platform/terms/maps-service-terms).

## Verification and limitations

The full automated suite passed **135 tests**, including service/area/assignment eligibility,
out-of-city branches, missing/stale/approximate coordinates, unknown coverage, duplicate identities,
straight-line labels, no-origin/tie ranking, denied/stale device location, ambiguous/partial/zero/failed
geocodes, same-origin retry, fail-closed quotas, no caching/fan-out, and map-loader failure/retry.
`npm run typecheck`, `npm run lint`, and `npm run build` passed. Stale generated route types were regenerated with the
installed `next typegen`; tracked application routes were not removed to make checks pass.
The test runtime's import rewrite was narrowed to import/export declarations so ordinary UI text
containing the word “from” is not misread as a module import.

Chrome/Playwright checks used a temporary, explicitly synthetic fixture at 1440px and 390px widths.
They verified selection/map synchronization with one map instance, desktop-right/mobile-stacked layout,
no horizontal overflow, location denial recovery, and the honest empty-coverage state. A separate
blocked-script case verified that map failure retains the list and allows an explicit retry.
Screenshots were inspected. All provider requests were mocked or intercepted; the temporary route
was removed before the production build. No browser package was added to repository dependencies.

No live Google API, device location, production database, billing project, or real office record was
verified. Actual Google basemap rendering and database RPC concurrency under deployed load remain
deployment acceptance checks. The empty registry, restricted credentials, quotas, public disclosures,
and verified office evidence remain production release gates. Code/tests alone do not establish
production readiness or authoritative branch coverage.
