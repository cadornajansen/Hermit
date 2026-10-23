// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { cityCenter, km, nearestBranches } from "./branches.ts"

test("sample branches are stable, nearby and sorted nearest first", () => {
  const list = nearestBranches("sss", "Taguig City")
  assert.deepEqual(nearestBranches("sss", "Taguig City"), list)
  assert.equal(list.length, 5)
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].km <= list[i].km)
  for (const b of list) assert.ok(b.km > 0.5 && b.km < 7.5, `${b.name} ${b.km}`)
  assert.notDeepEqual(nearestBranches("dfa", "Taguig City")[0], list[0])
})

test("city centres resolve common spellings and fall back to the pilot city", () => {
  assert.equal(cityCenter("City of Makati").approximate, false)
  assert.equal(cityCenter("Parañaque").approximate, false)
  assert.equal(cityCenter("Cebu City").approximate, true)
  assert.ok(Math.abs(km(cityCenter("Makati"), cityCenter("Taguig")) - 4) < 2)
})

test("sample branches around Taguig stay out of Laguna de Bay", () => {
  for (const a of ["sss", "dfa", "bir", "nbi"] as const)
    for (const b of nearestBranches(a, "Taguig")) assert.ok(!(b.lat < 14.535 && b.lng > 121.062), `${b.name} ${b.lat},${b.lng}`)
})
