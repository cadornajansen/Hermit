// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { EMPTY_PROFILE, REQUIREMENTS } from "./engine.ts"
import { fillForm, FIELDS, FORMS, formsFor } from "./forms.ts"

test("every form points at real requirements and fields, with unique ids", () => {
  const reqs = new Set(REQUIREMENTS.map((r) => r.id))
  assert.equal(new Set(FORMS.map((f) => f.id)).size, FORMS.length)
  for (const f of FORMS) {
    for (const r of f.requirementIds) assert.ok(reqs.has(r), `${f.id} → unknown requirement ${r}`)
    for (const k of f.fields) assert.ok(k in FIELDS, `${f.id} → unknown field ${k}`)
  }
})

test("pre-fill uses the profile first, then remembered values; forms follow ownership type", () => {
  const p = { ...EMPTY_PROFILE, structure: "sole" as const, ownerName: "Juana Dela Cruz", extra: { tin: "123" } }
  const fields = fillForm(FORMS.find((f) => f.id === "bir_1901")!, p)
  assert.equal(fields.find((f) => f.key === "owner_name")?.value, "Juana Dela Cruz")
  assert.equal(fields.find((f) => f.key === "tin")?.value, "123")
  assert.ok(fields.find((f) => f.key === "rdo_code") === undefined || fields.find((f) => f.key === "rdo_code")?.missing)
  const birForms = formsFor("bir_cor", p).map((f) => f.id)
  assert.ok(birForms.includes("bir_1901") && !birForms.includes("bir_1903"))
})
