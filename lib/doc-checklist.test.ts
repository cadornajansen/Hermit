// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { documentsFor } from "./doc-checklist.ts"
import { EMPTY_PROFILE } from "./engine.ts"

test("the list follows the owner's answers", () => {
  const renter = { ...EMPTY_PROFILE, ownerName: "Juana Dela Cruz", structure: "sole" as const, premises: "rented" as const, category: "food_service" as const, city: "Taguig", employees: "1_9" as const }
  const d = documentsFor("mayors_permit", renter)!
  const names = d.items.map((i) => i.name)
  assert.ok(names.includes("Contract of lease"))
  assert.ok(names.includes("Sanitary permit"))
  assert.ok(names[0].startsWith("Taguig"))
  assert.match(d.items.find((i) => i.name === "DTI Business Name Certificate")!.detail!, /Juana Dela Cruz/)
  assert.equal(d.askFirst.length, 0)

  const corp = documentsFor("mayors_permit", { ...renter, structure: "corporation", premises: "owned", category: "retail" })!
  const corpNames = corp.items.map((i) => i.name)
  assert.ok(corpNames.includes("SEC Certificate of Registration"))
  assert.ok(corpNames.includes("Secretary's certificate or board resolution"))
  assert.ok(corpNames.includes("Land title (TCT) or tax declaration"))
  assert.ok(!corpNames.includes("Sanitary permit"))
})

test("unknown answers that change the list become questions to ask first", () => {
  const d = documentsFor("brgy_clearance", EMPTY_PROFILE)!
  assert.deepEqual(d.askFirst.map((a) => a.field), ["structure", "premises"])
  assert.ok(!d.items.some((i) => i.vault === "lease"))
  assert.equal(documentsFor("nope", EMPTY_PROFILE), null)
})
