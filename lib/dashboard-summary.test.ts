import assert from "node:assert/strict"
import { test } from "node:test"

import { buildDashboardSummary, getBlockers, getUncertainPrerequisites, isCompleted } from "./dashboard-summary.ts"
import { getRequirement, healthScore } from "./engine.ts"
import type { ComplianceItem, Status } from "./types"

function item(id: string, overrides: Partial<ComplianceItem> = {}): ComplianceItem {
  const requirement = getRequirement("dti_bn")!
  return { ...requirement, id, name: id, prerequisites: [], applies: true, status: "not_started", ...overrides }
}

test("empty and optional-only checklists have no required progress or next action", () => {
  const empty = {
    done: 0, total: 0, submitted: 0, blocked: 0, needsConfirmation: 0,
    nextAction: null, awaitingSubmission: false,
  }
  assert.deepEqual(buildDashboardSummary([]), empty)
  assert.deepEqual(buildDashboardSummary([item("optional", { optional: true })]), empty)
})

test("submitted prerequisites remain blockers and are not chosen as next actions", () => {
  const registration = item("registration", { status: "submitted" })
  const permit = item("permit", { prerequisites: [registration.id] })
  const items = [registration, permit]

  assert.deepEqual(getBlockers(permit, items), [registration])
  assert.deepEqual(buildDashboardSummary(items), {
    done: 0, total: 2, submitted: 1, blocked: 1, needsConfirmation: 0,
    nextAction: null, awaitingSubmission: true,
  })
})

test("approved and expiring prerequisites unblock the next task", () => {
  for (const status of ["approved", "expiring"] satisfies Status[]) {
    const registration = item("registration", { status })
    const permit = item("permit", { prerequisites: [registration.id] })
    const items = [registration, permit]
    const summary = buildDashboardSummary(items)

    assert.equal(isCompleted(registration), true)
    assert.deepEqual(getBlockers(permit, items), [])
    assert.equal(summary.nextAction, permit)
    assert.equal(summary.done, 1)
    assert.equal(summary.blocked, 0)
  }
})

test("expired requirements reopen progress and block their dependent tasks", () => {
  const registration = item("registration", { status: "expired" })
  const permit = item("permit", { prerequisites: [registration.id] })
  const summary = buildDashboardSummary([permit, registration])

  assert.equal(isCompleted(registration), false)
  assert.equal(summary.done, 0)
  assert.equal(summary.blocked, 1)
  assert.equal(summary.nextAction, registration)
})

test("uncertain requirements prevent a dependent actionable claim until resolved", () => {
  const registration = item("registration", { applies: "maybe" })
  const permit = item("permit", { prerequisites: [registration.id] })
  const items = [registration, permit]
  const summary = buildDashboardSummary(items)

  assert.deepEqual(getBlockers(permit, items), [])
  assert.deepEqual(getUncertainPrerequisites(permit, items), [registration])
  assert.equal(summary.nextAction, null)
  assert.equal(summary.total, 1)
  assert.equal(summary.blocked, 0)
  assert.equal(summary.needsConfirmation, 1)

  const completedRegistration = { ...registration, status: "approved" as const }
  assert.deepEqual(getUncertainPrerequisites(permit, [completedRegistration, permit]), [])
  assert.equal(buildDashboardSummary([completedRegistration, permit]).nextAction, permit)
})

test("progress uses the health-score scope and excludes submitted or completed tasks from blocked counts", () => {
  const items = [
    item("missing-step"),
    item("done", { status: "approved", prerequisites: ["missing-step"] }),
    item("submitted", { status: "submitted", prerequisites: ["missing-step"] }),
    item("blocked", { prerequisites: ["missing-step"] }),
    item("optional-done", { optional: true, status: "approved" }),
    item("optional-submitted", { optional: true, status: "submitted" }),
    item("optional-blocked", { optional: true, prerequisites: ["missing-step"] }),
    item("uncertain-done", { applies: "maybe", status: "approved" }),
    item("excluded", { applies: false }),
  ]
  const summary = buildDashboardSummary(items)

  assert.deepEqual({ done: summary.done, total: summary.total }, healthScore(items))
  assert.equal(summary.done, 1)
  assert.equal(summary.total, 4)
  assert.equal(summary.submitted, 1)
  assert.equal(summary.blocked, 1)
  assert.equal(summary.needsConfirmation, 1)
})

test("omitted alternative registration paths do not block a completed legal path", () => {
  const registration = item("dti_bn", { status: "approved" })
  const permit = item("permit", { prerequisites: ["dti_bn", "sec_reg", "cda_reg"] })
  assert.equal(buildDashboardSummary([registration, permit]).nextAction, permit)
})

test("next action keeps checklist order and counts waiting only when there is no ready task", () => {
  const first = item("first", { status: "in_progress" })
  const second = item("second")
  const submitted = item("submitted", { status: "submitted" })
  const summary = buildDashboardSummary([submitted, first, second])

  assert.equal(summary.nextAction, first)
  assert.equal(summary.awaitingSubmission, false)
  assert.equal(buildDashboardSummary([item("optional-submitted", { optional: true, status: "submitted" })]).awaitingSubmission, true)
})

test("summary and dependency lookup preserve input items and their order", () => {
  const second = item("second", { applies: "maybe" })
  const first = item("first")
  const dependent = item("dependent", { prerequisites: ["second", "first"] })
  const items = [first, second, dependent]
  const before = JSON.stringify(items)
  for (const entry of items) {
    Object.freeze(entry.prerequisites)
    Object.freeze(entry)
  }
  Object.freeze(items)

  buildDashboardSummary(items)
  assert.deepEqual(getBlockers(dependent, items), [first])
  assert.deepEqual(getUncertainPrerequisites(dependent, items), [second])
  assert.equal(JSON.stringify(items), before)
})
