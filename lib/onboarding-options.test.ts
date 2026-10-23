import assert from "node:assert/strict"
import { test } from "node:test"

import { buildChecklist, EMPTY_PROFILE } from "./engine.ts"
import {
  getDetailOptions,
  getDetailQuestionIds,
  getDocumentOptions,
  getReviewFollowUp,
} from "./onboarding-options.ts"
import type { DocumentGroup } from "./onboarding-options.ts"
import type { ItemState, Profile } from "./types"

const retail: Profile = {
  ...EMPTY_PROFILE,
  activities: ["retail"],
  structure: "sole",
  employees: "none",
  assets: "under_3m",
  channel: "physical",
  flags: { food: false, alcohol: false, professional: false },
}

const ids = (groups: DocumentGroup[]): string[] =>
  groups.flatMap((group) => group.items.map((item) => item.id))

test("multiple activities share a single set of suggested questions", () => {
  const profile: Profile = {
    ...retail,
    activities: ["retail", "food_service", "water_refilling", "manufacturing"],
  }
  const options = getDetailOptions(profile)
  assert.equal(options.grouped, false)
  assert.deepEqual(options.groups, [
    { title: "", flags: ["food", "alcohol", "fda", "fuel", "import_export"] },
  ])
  const questions = getDetailQuestionIds(profile)
  assert.equal(questions.length, new Set(questions).size)
  assert.ok(questions.includes("packagedFood"))
  assert.ok(
    !options.remainingGroups
      .flatMap((group) => group.flags)
      .some((flag) => questions.includes(flag))
  )
})

test("Other and legacy unknown activities expose all questions in meaningful groups", () => {
  for (const profile of [
    { ...retail, activities: ["other"] } as Profile,
    { ...retail, activities: ["retail", "other"] } as Profile,
    { ...EMPTY_PROFILE, activities: "unknown" } as Profile,
    { ...EMPTY_PROFILE },
  ]) {
    const options = getDetailOptions(profile)
    assert.equal(options.grouped, true)
    assert.deepEqual(
      options.groups.map((group) => group.title),
      ["Products", "Services", "Trade"]
    )
    assert.equal(getDetailQuestionIds(profile).length, 10)
    assert.deepEqual(options.remainingGroups, [])
    assert.equal(options.packagedFood, false)
  }
})

test("manufacturing alone reveals the packaged-food follow-up without assuming its answer", () => {
  const profile: Profile = {
    ...retail,
    activities: ["manufacturing"],
    packagedFood: "unknown",
  }
  assert.equal(getDetailOptions(profile).packagedFood, true)
  assert.ok(getDetailQuestionIds(profile).includes("packagedFood"))
  assert.equal(
    getDetailOptions({ ...EMPTY_PROFILE, category: "packaged_food" })
      .packagedFood,
    true
  )
  assert.equal(
    getDetailOptions({ ...profile, activities: ["repair"] }).packagedFood,
    false
  )
  assert.equal(profile.packagedFood, "unknown")
})

test("an activity without suggestions leaves remaining questions in collapsed groups", () => {
  const options = getDetailOptions({ ...retail, activities: ["repair"] })
  assert.deepEqual(options.groups, [])
  assert.equal(
    options.remainingGroups.flatMap((group) => group.flags).length,
    10
  )
  assert.deepEqual(
    getDetailQuestionIds({ ...retail, activities: ["repair"] }),
    []
  )
})

test("documents use the existing rules to distinguish definite, possible and excluded matches", () => {
  const options = getDocumentOptions({
    ...retail,
    employees: "unknown",
    flags: { ...retail.flags, alcohol: "unknown" },
  })
  const matched = ids(options.matched)
  const possible = ids(options.possible)
  assert.ok(matched.includes("dti_bn"))
  assert.ok(matched.includes("bir_cor"))
  assert.ok(possible.includes("sss_er"))
  assert.ok(possible.includes("liquor_license"))
  assert.ok(![...matched, ...possible].includes("sec_reg"))
  assert.ok(![...matched, ...possible].includes("cda_reg"))
  assert.ok(![...matched, ...possible].includes("sanitary_permit"))
  assert.deepEqual(options.previous, [])
})

test("unknown legal form keeps alternative registrations possible and combined activities deduplicate documents", () => {
  const options = getDocumentOptions({
    ...retail,
    structure: "unknown",
    activities: ["retail", "food_service", "food_service"],
  })
  for (const id of ["dti_bn", "sec_reg", "cda_reg"])
    assert.ok(ids(options.possible).includes(id))
  const all = [...ids(options.matched), ...ids(options.possible)]
  assert.ok(all.includes("health_certs"))
  assert.equal(all.length, new Set(all).size)
})

test("document chooser excludes duties and preserves prior unmatched and unknown IDs once", () => {
  const profile: Profile = {
    ...retail,
    have: ["sec_reg", "tax_option", "legacy_certificate", "sec_reg", "dti_bn"],
  }
  const options = getDocumentOptions(profile)
  const offered = [...ids(options.matched), ...ids(options.possible)]
  for (const id of [
    "tax_option",
    "bir_display",
    "bir_books",
    "bir_invoices",
    "regulated_review",
    "platform_withholding",
    "withholding_comp",
  ]) {
    assert.ok(!offered.includes(id), id)
  }
  assert.deepEqual(
    options.previous.map((item) => item.id),
    ["sec_reg", "tax_option", "legacy_certificate"]
  )
  assert.equal(options.previous[0].name, "Company registration")
  assert.equal(options.previous[2].name, "legacy_certificate")
  assert.equal(profile.have.length, 5)
})

test("option helpers preserve profile answers and existing task progress", () => {
  const profile: Profile = {
    ...retail,
    flags: { food: "unknown", fuel: true, professional: false },
    have: ["dti_bn", "sec_reg"],
  }
  const states: Record<string, ItemState> = {
    dti_bn: { status: "submitted" },
    mayors_permit: { status: "approved", expiresOn: "2028-12-31" },
  }
  const before = structuredClone({ profile, states })
  const date = new Date("2026-10-22T00:00:00Z")
  const checklist = buildChecklist(profile, states, date)
  getDetailOptions(profile)
  getDocumentOptions(profile)
  getReviewFollowUp(retail, profile, [])
  assert.deepEqual({ profile, states }, before)
  assert.deepEqual(buildChecklist(profile, states, date), checklist)
  const cleared = buildChecklist({ ...profile, have: [] }, states, date)
  assert.equal(
    cleared.find((item) => item.id === "dti_bn")?.status,
    "submitted"
  )
  assert.equal(
    cleared.find((item) => item.id === "mayors_permit")?.status,
    "approved"
  )
})

test("review edits prioritize new tax choice, detail questions, then document choices", () => {
  const before: Profile = {
    ...retail,
    structure: "corporation",
    activities: ["repair"],
    sales: "under_500k",
  }
  const after: Profile = {
    ...before,
    structure: "sole",
    activities: ["food_service"],
    employees: "1_9",
  }
  assert.equal(getReviewFollowUp(before, after, []), "operations")
  assert.equal(getReviewFollowUp(before, after, ["operations"]), "details")
  assert.equal(
    getReviewFollowUp(before, after, ["operations", "details"]),
    "documents"
  )
  assert.equal(
    getReviewFollowUp(before, after, ["operations", "details", "documents"]),
    null
  )
})

test("review edits return directly when no new question or document appears", () => {
  const before: Profile = { ...retail, have: ["sec_reg"] }
  assert.equal(
    getReviewFollowUp(before, { ...before, businessName: "Updated store" }, []),
    null
  )
  assert.equal(getReviewFollowUp(before, { ...before, have: [] }, []), null)
  assert.equal(
    getReviewFollowUp(
      before,
      { ...before, employees: "none", activities: ["repair"] },
      []
    ),
    null
  )
  assert.equal(
    getReviewFollowUp(before, { ...before, sales: "over_3m" }, []),
    null
  )
})

test("review detects new manufacturing follow-up even when regulation questions already existed", () => {
  const before: Profile = { ...retail, activities: ["other"] }
  const after: Profile = { ...before, activities: ["other", "manufacturing"] }
  assert.equal(getReviewFollowUp(before, after, []), "details")
  assert.equal(
    getReviewFollowUp({ ...retail, sales: "over_3m" }, retail, []),
    "operations"
  )
})

test("possible-to-definite documents do not repeat document selection", () => {
  const before: Profile = { ...retail, employees: "unknown" }
  assert.equal(
    getReviewFollowUp(before, { ...before, employees: "1_9" }, []),
    null
  )
  assert.equal(
    getReviewFollowUp(retail, { ...retail, employees: "1_9" }, []),
    "documents"
  )
})

test("a second activity edit revisits new questions after Details was already reviewed", () => {
  const before: Profile = { ...retail, activities: ["repair"] }
  const firstEdit: Profile = {
    ...retail,
    flags: { ...retail.flags, food: true },
  }
  assert.equal(
    getReviewFollowUp(before, firstEdit, ["details"], { details: firstEdit }),
    "documents"
  )

  const secondEdit: Profile = { ...firstEdit, activities: ["retail", "other"] }
  assert.equal(
    getReviewFollowUp(before, secondEdit, ["business"], { details: firstEdit }),
    "details"
  )
  assert.equal(
    getReviewFollowUp(before, secondEdit, ["details"], { details: secondEdit }),
    "documents"
  )
  assert.equal(
    getReviewFollowUp(before, secondEdit, [], {
      details: secondEdit,
      documents: secondEdit,
    }),
    null
  )
})

test("reviewed operations and documents do not replay unless their choices change", () => {
  const before: Profile = { ...retail, structure: "corporation" }
  const reviewed: Profile = { ...retail, employees: "1_9" }
  const snapshots = {
    operations: reviewed,
    details: reviewed,
    documents: reviewed,
  }
  assert.equal(
    getReviewFollowUp(
      before,
      { ...reviewed, businessName: "New name" },
      [],
      snapshots
    ),
    null
  )
  const foodService: Profile = { ...reviewed, activities: ["food_service"] }
  assert.equal(
    getReviewFollowUp(before, foodService, [], snapshots),
    "documents"
  )

  const overThreshold: Profile = { ...reviewed, sales: "over_3m" }
  assert.equal(
    getReviewFollowUp(before, reviewed, [], {
      ...snapshots,
      operations: overThreshold,
    }),
    "operations"
  )
})
