// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { initialBoxes, pdfSafe, type Layout } from "./fill.ts"

const layout: Layout = {
  formId: "x",
  sha256: "",
  fillable: false,
  pages: [{ w: 612, h: 936 }],
  entries: [
    { key: "owner_name", page: 0, x: 30, y: 600, size: 9 },
    { key: "tin", page: 0, x: 100, y: 700, size: 9 },
    { key: "structure", page: 0, x: 50, y: 500, size: 8, mark: true, equals: "Sole proprietorship" },
    { key: "structure", page: 0, x: 150, y: 500, size: 8, mark: true, equals: "Partnership" },
  ],
}

test("fills known values, skips empty ones, marks only the matching option", () => {
  const boxes = initialBoxes(layout, { owner_name: "Juana Dela Cruz", tin: "", structure: "Sole proprietorship" })
  assert.deepEqual(boxes.map((b) => [b.kind, b.text, b.x]), [["text", "Juana Dela Cruz", 30], ["mark", "X", 50]])
})

test("text is made safe for standard PDF fonts", () => {
  assert.equal(pdfSafe("Nena’s Kainan – ₱30 Ñ"), "Nena's Kainan - PHP 30 Ñ")
  assert.equal(pdfSafe("pirma ✍️"), "pirma ")
})
