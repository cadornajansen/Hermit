import assert from "node:assert/strict"
import { test } from "node:test"
import { eligibleOffices, rankOffices, distanceLabel, currentEvidence } from "./office-finder.ts"
import { cities } from "./locations.ts"
import { findManilaBarangay, MANILA_BARANGAYS } from "./manila-barangays.ts"
import { mapsSearchUrl } from "./nearby.ts"
import { DEMO_OFFICES } from "./office-demo.ts"
import { OFFICE_REGISTRY, type OfficeEvidence, type OfficeRecord } from "./office-registry.ts"

const city = cities.find((entry) => entry.name === "City of Manila")!
const area = { city: city.name, province: city.province, barangay: "Synthetic Barangay" }
const evidence: OfficeEvidence = { sourceUrl: "https://agency.invalid/evidence", reviewer: "Synthetic reviewer", checkedOn: "2026-10-01", reviewDue: "2027-01-01" }
const today = "2026-10-23"
function record(id: string, patch: Partial<OfficeRecord> = {}): OfficeRecord {
  return {
    id, name: `Synthetic office ${id}`, type: "bplo", mode: "physical", status: "active", website: "https://agency.invalid/",
    address: "Synthetic address", physicalCityCode: city.code,
    services: [{ requirementId: "mayors_permit", serviceEvidence: evidence, coverageEvidence: evidence, areas: [{ cityCode: city.code }] }],
    coordinates: { lat: 14.6, lng: 120.98, precision: "entrance", license: "Independent synthetic fixture", evidence },
    ...patch,
  }
}

test("eligibility uses the exact service and jurisdiction before distance, including out-of-city branches", () => {
  const eligible = record("eligible", { physicalCityCode: "elsewhere", coordinates: { ...record("x").coordinates!, lat: 14.8 } })
  const wrongService = record("wrong-service", { services: [{ ...record("x").services[0], requirementId: "health_certs" }] })
  const wrongArea = record("wrong-area", { services: [{ ...record("x").services[0], areas: [{ cityCode: "elsewhere" }] }] })
  const results = eligibleOffices("mayors_permit", area, "", [wrongService, wrongArea, eligible], today)
  assert.deepEqual(results.offices.map((entry) => entry.office.id), ["eligible"])
  assert.equal(rankOffices(results.offices, { lat: 14.6, lng: 120.98 }).length, 1)
})

test("missing coverage is unknown; reviewed barangay matching and branch assignment are explicit", () => {
  const base = record("assigned")
  const assigned = record("assigned", { services: [{ ...base.services[0], areas: [{ cityCode: city.code, barangays: ["Synthetic Barangay"] }], assignmentRequired: true }] })
  assert.equal(eligibleOffices("mayors_permit", area, "", [assigned], today).needsAssignment, 1)
  assert.equal(eligibleOffices("mayors_permit", area, "other", [assigned], today).offices.length, 0)
  assert.equal(eligibleOffices("mayors_permit", area, "assigned", [assigned], today).offices.length, 1)
  assert.equal(eligibleOffices("mayors_permit", { ...area, barangay: "" }, "assigned", [assigned], today).offices.length, 0)
  assert.equal(eligibleOffices("mayors_permit", area, "", [record("unknown", { services: [{ ...base.services[0], areas: [] }] })], today).offices.length, 0)
  assert.ok(eligibleOffices("mayors_permit", { city: "San Jose" }, "", [base], today).issue)
})

test("stale capabilities and coverage cannot appear as eligible; closed offices are excluded", () => {
  const base = record("stale")
  for (const field of ["serviceEvidence", "coverageEvidence"] as const) {
    const stale = record("stale", { services: [{ ...base.services[0], [field]: { ...evidence, reviewDue: "2026-10-22" } }] })
    const result = eligibleOffices("mayors_permit", area, "", [stale], today)
    assert.equal(result.offices.length, 0)
    assert.equal(result.needsReview, 1)
  }
  assert.equal(eligibleOffices("mayors_permit", area, "", [record("closed", { status: "closed" })], today).offices.length, 0)
  assert.equal(currentEvidence({ ...evidence, checkedOn: "2027-01-01" }, today), false)
  assert.equal(currentEvidence({ ...evidence, checkedOn: "2026-02-30" }, today), false)
  assert.equal(currentEvidence({ ...evidence, sourceUrl: "javascript:alert(1)" }, today), false)
})

test("missing, approximate, stale and invalid coordinates stay eligible but unranked; online services have no pins", () => {
  const base = record("x")
  const registry = [
    record("missing", { coordinates: undefined }),
    record("approximate", { coordinates: { ...base.coordinates!, precision: "approximate" } }),
    record("stale", { coordinates: { ...base.coordinates!, evidence: { ...evidence, reviewDue: "2026-10-22" } } }),
    record("invalid", { coordinates: { ...base.coordinates!, lat: NaN } }),
    record("online", { mode: "online" }),
    record("mapped"),
  ]
  const result = rankOffices(eligibleOffices("mayors_permit", area, "", registry, today).offices, { lat: 14.6, lng: 120.98 })
  assert.equal(result.length, 6)
  assert.equal(result[0].office.id, "mapped")
  assert.equal(result[0].km, 0)
  assert.ok(result.slice(1).every((entry) => entry.km === undefined && entry.point === undefined))
  assert.match(distanceLabel(3.14), /Approximate straight-line distance: about 3.1 km/)
})

test("distance ties are stable and origin changes never change eligibility", () => {
  const matches = eligibleOffices("mayors_permit", area, "", [record("b"), record("a")], today).offices
  assert.deepEqual(rankOffices(matches, { lat: 0, lng: 0 }).map((entry) => entry.office.id), ["a", "b"])
  assert.deepEqual(rankOffices(matches).map((entry) => entry.km), [undefined, undefined])
  assert.deepEqual(rankOffices(matches, { lat: 40, lng: 140 }).map((entry) => entry.office.id), ["a", "b"])
})

test("Manila seed lists only source-backed permit handlers; branch assignment and map coordinates stay explicit", () => {
  const permit = eligibleOffices("mayors_permit", area, "", OFFICE_REGISTRY, today).offices
  assert.deepEqual(permit.map((entry) => entry.office.id), ["manila-bureau-of-permits"])
  assert.equal(permit[0].point, undefined)
  assert.equal(eligibleOffices("mayors_permit", { city: "Quezon City" }, "", OFFICE_REGISTRY, today).offices.length, 0)
  assert.deepEqual(eligibleOffices("health_certs", area, "", OFFICE_REGISTRY, today).offices.map((entry) => entry.office.id), ["manila-health-department"])
  assert.deepEqual(eligibleOffices("brgy_clearance", area, "", OFFICE_REGISTRY, today).offices.map((entry) => entry.office.id), ["manila-bureau-of-permits"])
  assert.equal(eligibleOffices("dti_bn", area, "", OFFICE_REGISTRY, today).offices[0].office.physicalCityCode, "1380300000")
  assert.equal(eligibleOffices("cda_reg", area, "", OFFICE_REGISTRY, today).offices[0].office.physicalCityCode, "1381300000")
  const bir = eligibleOffices("bir_cor", area, "", OFFICE_REGISTRY, today)
  assert.equal(bir.assignments.length, 6)
  assert.equal(bir.offices.length, 0)
  assert.deepEqual(eligibleOffices("bir_cor", area, "bir-rdo-29", OFFICE_REGISTRY, today).offices.map((entry) => entry.office.id), ["bir-rdo-29"])
  assert.ok(OFFICE_REGISTRY.every((entry) => entry.mode === "online" || (entry.address && entry.addressEvidence && !entry.coordinates)))
  assert.match(mapsSearchUrl("Manila City Hall"), /maps\/search\/\?api=1&query=Manila%20City%20Hall/)
  assert.doesNotMatch(mapsSearchUrl("Manila City Hall"), /origin=/)
})

test("all 897 Manila barangay identities are searchable without implying a verified hall", () => {
  assert.equal(MANILA_BARANGAYS.length, 897)
  assert.equal(new Set(MANILA_BARANGAYS.map((entry) => entry.code)).size, 897)
  assert.equal(new Set(MANILA_BARANGAYS.map((entry) => entry.name)).size, 897)
  assert.deepEqual(findManilaBarangay("Brgy. 1"), { code: "1380601001", name: "Barangay 1", district: "Tondo I/II" })
  assert.equal(findManilaBarangay("Unknown hall"), undefined)
  assert.equal(eligibleOffices("brgy_clearance", area, "", OFFICE_REGISTRY, today).offices.length, 1)
})

test("local demo records can mix with government records without changing production registry", () => {
  const production = eligibleOffices("mayors_permit", area, "", OFFICE_REGISTRY, today).offices
  const local = eligibleOffices("mayors_permit", area, "", [...OFFICE_REGISTRY, ...DEMO_OFFICES], today).offices
  assert.equal(production.length, 1)
  assert.equal(local.length, 3)
  assert.equal(local.filter((entry) => entry.point).length, 2)
  assert.ok(local.filter((entry) => entry.office.id.startsWith("demo-")).every((entry) => entry.office.website === "https://example.org/"))
})

test("duplicate branch identities cannot produce a confirmed eligible result", () => {
  assert.equal(eligibleOffices("mayors_permit", area, "", [record("duplicate"), record("duplicate")], today).offices.length, 0)
})
