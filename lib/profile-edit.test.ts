// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { EMPTY_PROFILE } from "./engine.ts"
import { applyProfileChanges, setChanges } from "./profile-edit.ts"

const base = { ...EMPTY_PROFILE, ownerName: "Juana Dela Cruz", birthDate: "1980-05-14", identityVerified: true, city: "Taguig", province: "Metro Manila", region: "NCR" }

test("Kuya Hermit's profile changes are validated and normalised", () => {
  const r = applyProfileChanges(base, { tin: "2190006892", mobile: "0917 123 4567", taxOption: "8pct", rdoCode: "44", password: "x", sales: "lots" })
  assert.equal(r.profile.tin, "219-000-689-2")
  assert.equal(r.profile.mobile, "+639171234567")
  assert.equal(r.profile.taxOption, "8pct")
  assert.deepEqual(r.rejected.map((x) => x.field), ["rdoCode", "password", "sales"])
  assert.deepEqual(r.applied.map((c) => c.field), ["tin", "mobile", "taxOption"])
})

test("renaming clears the verified flag; moving city clears province and region; undo restores all", () => {
  const r = applyProfileChanges(base, { ownerName: "Juana Santos", city: "Makati" })
  assert.equal(r.profile.identityVerified, false)
  assert.equal(r.profile.province, undefined)
  const back = setChanges(r.profile, r.applied, "from")
  assert.equal(back.ownerName, "Juana Dela Cruz")
  assert.equal(back.identityVerified, true)
  assert.equal(back.city, "Taguig")
  assert.equal(back.region, "NCR")
})
