# Runtime fixes

Implemented against clean checkout `8ea68b2` on `feat/early-phase`, using
`hermit-runtime-fix-plan.md` from the local support directory as the acceptance contract.
All fixtures are synthetic. External service boundaries are stubbed.

## Issue outcomes

| Issue | Outcome | Evidence / resulting behavior |
| --- | --- | --- |
| Task-aware packet forms | Fixed | New sole-proprietor BIR registration selects only 1901; update selects 1905; abatement selects 2121. Corporation selection retains PBH and 1903. DTI renewal is explicit. Each packet form records its reason. |
| Prepared official forms | Fixed | Official PDFs are fetched, parsed, filled and copied before the cover. Cover and body use the same prepared pages or explained info-sheet fallback, including HTTP 503. |
| Attachment outcomes | Fixed | Real synthetic PDF, PNG and JPEG bytes produce attachment pages. WebP and corrupt bytes produce explicit omission reasons. Fetch/decode/embed failures do not produce included entries or checked attachment boxes. |
| Document review states in packets | Fixed | Only verified documents are attempted; pending review and rejection are shown separately and omitted. There is no implicit opt-in for unreviewed files. |
| Maps address cache center | Fixed | Address cache hits return the original geocoded center and offices without new upstream requests. Coordinate searches retain rounded coordinates. |
| Maps failures versus empty results | Fixed | Total Places failure returns an error. Mixed outcomes retain offices and failed types. Successful empty results remain successful. Rendered UI checks distinguish unavailable, partial and no-match states, with retry. Partial results are not cached. |
| Province-aware Maps address | Fixed | San Jose, Tarlac retains province and region. Existing freeform locality text is deduplicated; profiles without province still work. |
| Owner confirmation versus completion | Fixed | Blank, partial, unknown and invalid-date evidence stays in review even after confirmation. Populated supported evidence can pass identity/detail checks. Confirmation never approves the checklist. Original reader evidence and owner corrections remain separate. |
| Name suffix splitting | Fixed | Jr., Sr., II and III are removed before first/middle/family splitting. Filipino surname particles remain intact. Layouts can target a separate suffix field; the layout-generation schema/prompt supports it. |
| Jurisdiction-aware guidance | Fixed | Canonical PSGC jurisdiction and filing task gate Taguig portals and PDF copies. Cebu, ambiguous and contradictory locations receive general LGU guidance. Dashboard, packet, office and assistant callers use the same location context. |
| Sync conflict-policy concern | Not reproduced as a policy violation | The repaired current-interface harness confirms ordinary hydration retains the local working copy without overwriting a newer acknowledged server profile; explicit restore selects the server copy. This matches the documented device working-copy policy. No general merge-policy change was made. |
| Sync write errors and pending work | Fixed | Regressions first reproduced silent DB errors and missing durable pending writes. Writes now require acknowledgement; failures remain visible. Profile/checklist, document metadata, deletes, events and chat clearing survive reload and retry. Older acknowledgements cannot clear newer edits. Restore preserves pending work until acknowledged. |

No issue is blocked.

## Limited deviations

- Unsupported new WebP/HEIC uploads are rejected with PDF/PNG/JPEG conversion guidance instead of adding a browser
  image conversion dependency. Legacy unsupported vault files are explicitly omitted from packets.
- The existing model has no independent application-completion or agency-issuance evidence. Automatic checklist
  approval was therefore removed from document review. A fully populated document can still pass the existing
  identity/detail rules and appear in coverage/packets; owners update checklist status separately after issuance.
  OCR and owner confirmation do not establish issuance. This avoids inventing an issuance model or a schema migration.
- Jurisdiction gating also covers the stored Taguig application and assistant form tools, because those paths could
  otherwise reintroduce another city's material after the process links were corrected.
- Sync reconciliation keeps the established conflict policy. Only reproduced acknowledgement/retry failures were
  changed. Optional pending-operation fields extend the existing owner-scoped browser snapshot; no DB schema changes
  or production connections are required. Existing scoped snapshots still load without those fields.

## Minimum document evidence

Every supported type needs a readable owner or business name. Existing owner, business, type, expiry, locality and
duplicate checks still apply, and every warning keeps the document in review.

| Type | Additional minimum evidence |
| --- | --- |
| Government ID | Owner name and document number; expiry remains subject to the existing validity rule |
| Lease / title / consent | Property address and a valid issue date |
| Health certificate / cedula | Owner name, document number, valid issue date and expiry |
| BIR COR | Business name, TIN and valid issue date |
| Other supported permits / registration certificates | Business name, document number, valid issue date and expiry where the type requires it |
| Unknown / generic “other” | Always needs review |

Issue dates must be real ISO dates and cannot be in the future. “Verified” is a deterministic identity/detail
assessment, not an authenticity or issuance guarantee. Existing stored verdicts can be reevaluated using Vault's
recheck control. Historical checklist approvals are not automatically rewritten, since the model cannot distinguish
an owner-set status from a previous automatic approval.

## Verification

The baseline `npm test` passed 59 tests before implementation. The repaired
`node scripts/sync-reproduction.mjs` passed both policy assertions before sync logic was changed.
The final focused command was:

```sh
node --test lib/pack.test.ts lib/maps.test.ts lib/vault.test.ts lib/vault-ui.test.ts lib/fill.test.ts lib/processes.test.ts lib/sync.test.ts lib/runtime-flows.test.ts
```

It passed 33 tests with 0 failures, skips or cancellations. Packet tests inspect generated PDF text and page counts.
Maps and Vault checks exercise rendered component logic; assistant checks drive the real tool loop through a stubbed
gateway. Sync checks run production store/actions with in-memory storage and database/session stubs.

Final verification results:

| Exact command | Result |
| --- | --- |
| `npm test` | 80 passed, 0 failed, 0 skipped, 0 cancelled; exit 0 |
| `npm run typecheck` | `tsc --noEmit`, no errors; exit 0 |
| `npm run lint` | ESLint, no errors or warnings; exit 0 |
| `node scripts/sync-reproduction.mjs` | Both ordinary-hydration and explicit-restore assertions passed; exit 0 |
| `node --check scripts/layout-forms.mjs` | Syntax check passed; exit 0 |
| `git diff --check` | No whitespace errors; exit 0 |

Commands used the installed dependencies under Node `v24.16.0`. The `pnpm` executable was unavailable, so the
package's existing scripts were invoked with npm; no dependencies or lockfiles were changed.

## Changed files

| Area | Files |
| --- | --- |
| Packet and filing tasks | `lib/pack.ts`, `lib/forms.ts`, `components/chat.tsx` |
| Maps | `app/maps.ts`, `app/(app)/offices/page.tsx`, `lib/nearby.ts` |
| Document evidence and uploads | `lib/vault.ts`, `lib/types.ts`, `components/vault.tsx`, `app/actions.ts` |
| Names | `lib/fill.ts`, `scripts/layout-forms.mjs` |
| Jurisdiction and connected callers | `lib/processes.ts`, `lib/locations.ts`, `lib/offices.ts`, `lib/library.ts`, `lib/hermit.ts`, `components/form-sheet.tsx`, `components/pdf-editor.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/forms/page.tsx` |
| Sync | `lib/store.ts`, `app/sync.ts`, `components/owner-status.tsx`, `scripts/sync-reproduction.mjs` |
| Regression coverage | `lib/pack.test.ts`, `lib/maps.test.ts`, `lib/vault.test.ts`, `lib/vault-ui.test.ts`, `lib/fill.test.ts`, `lib/processes.test.ts`, `lib/sync.test.ts`, `lib/runtime-flows.test.ts`, `lib/store.test.ts`, `test-support/runtime.mjs` |
| Documentation | `README.md`, `docs/runtime-fixes.md` |

## Remaining limits

- No production service, real owner data, live filing portal, Maps key or database is used by these checks.
- No live browser, official-form placement/accuracy, agency acceptance, deployed build or real issuance is claimed.
  Existing layouts are not regenerated; suffix placement requires a mapped suffix target.
- General jurisdiction-specific office/portal data remains limited to Taguig. Unsupported places require LGU
  confirmation; national services remain available.
- Sync retains device working-copy semantics, without automatic conflict merging across tabs/devices. Browser
  persistence must remain available for retry across reload. Metadata retry does not upload a device-only binary
  whose original storage upload failed.
- Event retries check for already committed matching entries. Without a database uniqueness constraint, simultaneous
  identical event submissions from separate clients can still create duplicates; exactly-once delivery is not claimed.
