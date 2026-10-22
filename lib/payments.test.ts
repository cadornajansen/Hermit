// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { FORMS } from "./forms.ts"
import { parseAmount, PAYABLES, periodsFor } from "./payments.ts"

test("every payable points at a catalog form", () => {
  for (const p of PAYABLES) assert.ok(FORMS.some((f) => f.id === p.formId), p.formId)
})

test("periods list the most recent completed period first", () => {
  const oct = new Date(2026, 9, 22)
  assert.deepEqual(periodsFor("quarter", oct).map((p) => p.value), ["2026-Q3", "2026-Q2", "2026-Q1", "2025-Q4"])
  assert.equal(periodsFor("quarter", new Date(2026, 1, 3))[0].value, "2025-Q4")
  assert.equal(periodsFor("month", oct)[0].value, "2026-09")
  assert.equal(periodsFor("year", oct)[0].value, "2025")
})

test("amounts must be positive pesos with at most centavos", () => {
  assert.equal(parseAmount("₱1,234.50"), 1234.5)
  assert.equal(parseAmount("0"), null)
  assert.equal(parseAmount("12.345"), null)
  assert.equal(parseAmount("abc"), null)
})
