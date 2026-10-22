// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { distanceKm, OFFICE_SEARCH, roughly } from "./nearby.ts"

test("distance between Taguig City Hall and BGC is about 3–5 km", () => {
  const d = distanceKm({ lat: 14.5306, lng: 121.0807 }, { lat: 14.5509, lng: 121.0503 })
  assert.ok(d > 3 && d < 5, String(d))
})

test("office name checks reject look-alikes", () => {
  assert.ok(OFFICE_SEARCH.bir_rdo!.match.test("BIR Revenue District Office No. 44"))
  assert.ok(!OFFICE_SEARCH.bir_rdo!.match.test("Birchwood Cafe"))
  assert.ok(OFFICE_SEARCH.sss!.match.test("SSS Taguig Branch"))
  assert.ok(!OFFICE_SEARCH.sss!.match.test("Sassy Salon"))
  assert.ok(OFFICE_SEARCH.pagibig!.match.test("Pag-IBIG Fund - Taguig"))
})

test("locations are rounded before leaving the server", () => {
  assert.equal(roughly(14.530612345), 14.531)
})
