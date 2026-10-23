// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { newRefNo, track } from "./submissions.ts"

test("a filed application moves through its steps over time", () => {
  const at = "2026-10-23T08:00:00.000Z"
  const t0 = Date.parse(at)
  assert.equal(track("application", at, t0).status, "Submitted")
  assert.equal(track("application", at, t0 + 70_000).status, "Documents under review")
  const done = track("application", at, t0 + 400_000)
  assert.equal(done.status, "Approved: ready to claim")
  assert.equal(done.finished, true)
  assert.equal(track("return", at, t0 + 30_000).steps.filter((s) => s.done).length, 2)
  // Server clock ahead of the device: still shows as filed.
  assert.equal(track("return", at, t0 - 5_000).status, "Filed")
})

test("reference numbers say what was filed", () => {
  assert.match(newRefNo("return", "a1b2c3"), /^RTN-\d{8}-A1B2C3$/)
  assert.match(newRefNo("application", "ffffff"), /^APP-\d{8}-FFFFFF$/)
})
