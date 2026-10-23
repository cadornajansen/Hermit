import assert from "node:assert/strict"
import { test } from "node:test"

import {
  activityMatches,
  activitySummary,
  coverageActivities,
  getActivities,
  normalizeProfile,
  packagedFoodMatches,
} from "./activities.ts"
import { EMPTY_PROFILE } from "./engine.ts"
import type { Activity, Category, Profile } from "./types"

test("legacy single categories migrate to activities without losing owner data", () => {
  for (const [category, activity] of [
    ["retail", "retail"],
    ["food_service", "food_service"],
    ["other", "other"],
  ] satisfies [Category, Activity][]) {
    const profile: Profile = {
      ...EMPTY_PROFILE,
      category,
      ownerName: "Ana Cruz",
      businessName: "Ana's Store",
      have: ["dti_bn"],
      extra: { tin: "owner-entered" },
    }
    const migrated = normalizeProfile(profile)
    assert.deepEqual(migrated, { ...profile, activities: [activity] })
    assert.deepEqual(normalizeProfile(migrated), migrated)
  }
})

test("legacy packaged food retains its specific food detail after migration", () => {
  const profile: Profile = { ...EMPTY_PROFILE, category: "packaged_food" }
  const migrated = normalizeProfile(profile)
  assert.deepEqual(getActivities(migrated), ["manufacturing"])
  assert.equal(migrated.packagedFood, true)
  assert.equal(packagedFoodMatches(profile), true)
  assert.equal(packagedFoodMatches(migrated), true)
})

test("explicit activities override legacy category and are deduplicated on load", () => {
  const profile: Profile = {
    ...EMPTY_PROFILE,
    category: "packaged_food",
    activities: ["retail", "retail", "repair"],
  }
  const migrated = normalizeProfile(profile)
  assert.deepEqual(migrated.activities, ["retail", "repair"])
  assert.equal(migrated.packagedFood, undefined)
  assert.equal(packagedFoodMatches(migrated), false)
  assert.equal(activitySummary(migrated), "Retail, Repair")
})

test("unknown and unanswered activities remain possibly applicable", () => {
  for (const activities of ["unknown", []] as const) {
    const profile: Profile = { ...EMPTY_PROFILE, category: "retail", activities: activities === "unknown" ? "unknown" : [] }
    assert.equal(activityMatches(profile, "food_service"), "maybe")
    assert.equal(packagedFoodMatches(profile), "maybe")
  }
})

test("manufacturing requires a separate packaged-food answer", () => {
  const profile: Profile = { ...EMPTY_PROFILE, activities: ["manufacturing"] }
  assert.equal(packagedFoodMatches(profile), "maybe")
  assert.equal(packagedFoodMatches({ ...profile, packagedFood: false }), false)
  assert.equal(packagedFoodMatches({ ...profile, packagedFood: true }), true)
  assert.equal(packagedFoodMatches({ ...profile, packagedFood: "unknown" }), "maybe")
  assert.equal(packagedFoodMatches({ ...profile, activities: ["repair"], packagedFood: true }), false)
})

test("coverage notices identify activity branches that need confirmation", () => {
  const profile: Profile = {
    ...EMPTY_PROFILE,
    activities: ["retail", "food_service", "water_refilling", "manufacturing", "repair"],
    packagedFood: false,
  }
  assert.deepEqual(coverageActivities(profile), ["water_refilling", "manufacturing", "repair"])
  assert.deepEqual(coverageActivities({ ...profile, packagedFood: true }), ["water_refilling", "repair"])
})
