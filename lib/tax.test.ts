// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { computeTax, graduated } from "./tax.ts"

test("graduated TRAIN table brackets", () => {
  assert.equal(graduated(250_000), 0)
  assert.equal(graduated(400_000), 22_500)
  assert.equal(graduated(800_000), 102_500)
  assert.equal(graduated(2_000_000), 402_500)
  assert.equal(graduated(8_000_000), 2_202_500)
  assert.equal(graduated(300_000), 7_500)
})

test("percentage tax is 3% of the quarter's gross", () => {
  assert.equal(computeTax("bir_2551q", "graduated", { gross: 150_000 })!.due, 4_500)
})

test("8% option: cumulative, ₱250k exemption, less earlier quarters", () => {
  assert.equal(computeTax("bir_1701q", "8pct", { gross: 200_000 })!.due, 0)
  // YTD 600k → 8% of 350k = 28,000; 4,000 paid before → 24,000
  assert.equal(computeTax("bir_1701q", "8pct", { gross: 300_000, grossPrior: 300_000, paidPrior: 4_000 })!.due, 24_000)
})

test("graduated with OSD or itemized deductions", () => {
  // 1,000,000 gross, OSD 40% → 600,000 taxable → 22,500 + 20% × 200,000 = 62,500
  assert.equal(computeTax("bir_1701", "graduated", { gross: 1_000_000 })!.due, 62_500)
  // itemized 700,000 → 300,000 taxable → 7,500
  assert.equal(computeTax("bir_1701", "graduated", { gross: 1_000_000, expenses: 700_000 })!.due, 7_500)
})

test("VAT payable and corporate income tax", () => {
  assert.equal(computeTax("bir_2550q", "unknown", { gross: 1_000_000, purchases: 400_000 })!.due, 72_000)
  assert.equal(computeTax("bir_2550q", "unknown", { gross: 100_000, purchases: 400_000 })!.due, 0)
  assert.equal(computeTax("bir_1702q", "unknown", { gross: 2_000_000, expenses: 1_500_000, smallCorp: true })!.due, 100_000)
  assert.equal(computeTax("bir_1702", "unknown", { gross: 2_000_000, expenses: 1_500_000 })!.due, 125_000)
  assert.equal(computeTax("bir_1601c", "unknown", { gross: 1 }), null)
})
