// Run: pnpm test  (node --test, no framework)
import assert from "node:assert/strict"
import { test } from "node:test"

import type { Profile } from "./types"
import { buildCalendar, buildChecklist, diffChecklists, EMPTY_PROFILE, healthScore, shiftToBusinessDay } from "./engine.ts"

const nena: Profile = {
  ...EMPTY_PROFILE,
  category: "retail",
  stage: "operating_unregistered",
  structure: "sole",
  premises: "home",
  channel: "physical",
  assets: "under_3m",
  sales: "under_500k",
  taxOption: "8pct",
  employees: "none",
  flags: { food: true, alcohol: false, fda: false, fuel: false },
}
const ids = (p: Profile) => buildChecklist(p, {}).map((i) => i.id)

test("sari-sari sole proprietor gets the universal path, not the employer path", () => {
  const got = ids(nena)
  for (const id of ["dti_bn", "brgy_clearance", "mayors_permit", "bir_cor", "sanitary_permit", "bmbe", "tax_option"]) assert.ok(got.includes(id), id)
  for (const id of ["sec_reg", "sss_er", "fda_lto", "liquor_license", "platform_withholding"]) assert.ok(!got.includes(id), id)
})

test("unknown answers become 'possibly required' instead of being dropped", () => {
  const item = buildChecklist({ ...nena, employees: "unknown" }, {}).find((i) => i.id === "sss_er")
  assert.equal(item?.applies, "maybe")
})

test("hiring the first employee adds the employer items", () => {
  const { added, removed } = diffChecklists(nena, { ...nena, employees: "1_9" })
  assert.equal(added.length, 5)
  assert.deepEqual(removed, [])
})

test("health score counts approved required items only", () => {
  const items = buildChecklist({ ...nena, have: ["dti_bn", "bmbe"] }, {})
  const { done, total } = healthScore(items)
  assert.equal(done, 1) // bmbe is optional
  assert.ok(total > 5)
})

test("expiry dates drive expiring / expired", () => {
  const today = new Date("2026-12-15")
  const [permit] = buildChecklist(nena, { mayors_permit: { status: "approved", expiresOn: "2026-12-31" } }, today).filter((i) => i.id === "mayors_permit")
  assert.equal(permit.status, "expiring")
  const [late] = buildChecklist(nena, { mayors_permit: { status: "approved", expiresOn: "2026-12-01" } }, today).filter((i) => i.id === "mayors_permit")
  assert.equal(late.status, "expired")
})

test("calendar: weekend due dates shift to Monday", () => {
  // 2026-04-25 is a Saturday
  assert.equal(shiftToBusinessDay(new Date(Date.UTC(2026, 3, 25))).toISOString().slice(0, 10), "2026-04-27")
})

test("calendar: 8% sole proprietor has no 2551Q; employers get monthly 1601-C", () => {
  const from = new Date("2026-01-01T00:00:00")
  const forms = (p: Profile) => buildCalendar(p, [], from).map((d) => d.form)
  assert.ok(!forms(nena).includes("BIR 2551Q"))
  assert.ok(forms({ ...nena, taxOption: "graduated" }).includes("BIR 2551Q"))
  assert.equal(forms({ ...nena, employees: "1_9" }).filter((f) => f === "BIR 1601-C").length, 12)
})
