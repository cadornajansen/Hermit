// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { memorable } from "./memory.ts"

test("memory keeps short facts and refuses IDs, amounts and secrets", () => {
  assert.equal(memorable("  Rents the store   from a relative "), "Rents the store from a relative")
  assert.equal(memorable("Plans to hire 2 staff in January"), "Plans to hire 2 staff in January")
  assert.equal(memorable("TIN is 123-456-789-000"), null)
  assert.equal(memorable("SSS number 34-2258901-5"), null)
  assert.equal(memorable("Sales are ₱500,000 a year"), null)
  assert.equal(memorable("Her OTP is 1234"), null)
  assert.equal(memorable("x".repeat(200)), null)
  assert.equal(memorable(42), null)
})
