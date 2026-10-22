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

test("pre-fill uses account facts but never treats legacy extras as consent; forms follow ownership type", () => {
  const p = { ...EMPTY_PROFILE, structure: "sole" as const, ownerName: "Juana Dela Cruz", extra: { tin: "123" } }
  const fields = fillForm(FORMS.find((f) => f.id === "bir_1901")!, p)
  assert.equal(fields.find((f) => f.key === "owner_name")?.value, "Juana Dela Cruz")
  assert.equal(fields.find((f) => f.key === "tin")?.value, "")
  assert.ok(fields.find((f) => f.key === "rdo_code") === undefined || fields.find((f) => f.key === "rdo_code")?.missing)
  const birForms = formsFor("bir_cor", p).map((f) => f.id)
  assert.ok(birForms.includes("bir_1901") && !birForms.includes("bir_1903"))
})

test("every stored official copy belongs to a catalog form and source", async () => {
  const { readFileSync } = await import("node:fs")
  const manifest = JSON.parse(readFileSync(new URL("./form-files.json", import.meta.url), "utf8"))
  for (const [formId, entries] of Object.entries(manifest) as [string, { sourceUrl: string; path: string; sha256: string }[]][]) {
    const form = FORMS.find((f) => f.id === formId)
    assert.ok(form, `manifest has unknown form ${formId}`)
    for (const e of entries) {
      assert.ok(form.files?.some((f) => f.url === e.sourceUrl), `${formId}: ${e.sourceUrl} not in catalog`)
      assert.ok(e.path.startsWith(`${formId}/`) && /^[0-9a-f]{64}$/.test(e.sha256))
    }
  }
})

test("every start-here link is for a real requirement and uses https", async () => {
  const { PROCESSES } = await import("./processes.ts")
  const reqs = new Set(REQUIREMENTS.map((r) => r.id))
  for (const [id, p] of Object.entries(PROCESSES)) {
    assert.ok(reqs.has(id), `unknown requirement ${id}`)
    assert.ok(p.links.length || p.office, `${id} has neither a link nor an office`)
    for (const l of p.links) assert.match(l.url, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/, `${id}: ${l.url}`)
  }
})
