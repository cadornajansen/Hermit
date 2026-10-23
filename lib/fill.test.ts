// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { formatDate, initialBoxes, pdfSafe, splitName, type Layout } from "./fill.ts"

const layout: Layout = {
  formId: "x",
  sha256: "",
  fillable: false,
  pages: [{ w: 612, h: 936 }],
  entries: [
    { key: "owner_name", page: 0, x: 30, y: 600, size: 9, part: "last", format: "upper" },
    { key: "owner_name", page: 0, x: 130, y: 600, size: 9, part: "first", format: "upper" },
    { key: "tin", page: 0, x: 100, y: 700, size: 9, pitch: 12, slots: 12 },
    { key: "birth_date", page: 0, x: 100, y: 650, size: 9, format: "date" },
    { key: "business_name", page: 0, x: 10, y: 550, size: 9, maxWidth: 40 },
    { key: "structure", page: 0, x: 50, y: 500, size: 8, mark: true, equals: "Sole proprietorship" },
    { key: "structure", page: 0, x: 150, y: 500, size: 8, mark: true, equals: "Partnership" },
    { key: "__constant", page: 0, x: 20, y: 800, size: 8, mark: true },
    { key: "__signature", page: 0, x: 200, y: 100, size: 120, signature: true },
    { key: "__today", page: 0, x: 400, y: 100, size: 9 },
    { key: "email", page: 0, x: 1, y: 1, size: 9 },
    { key: "mobile", page: 0, x: 300, y: 300, size: 9, pitch: 10, slots: 11 },
    { key: "dti_no", page: 0, x: 300, y: 320, size: 9, pitch: 10, slots: 4 },
  ],
}

test("splits Filipino names, keeping surname particles", () => {
  assert.deepEqual(splitName("Juana Santos Dela Cruz"), { first: "Juana", middle: "Santos", last: "Dela Cruz", suffix: "" })
  assert.deepEqual(splitName("Juan de los Santos"), { first: "Juan", middle: "", last: "de los Santos", suffix: "" })
  assert.deepEqual(splitName("Maria Clara Reyes Garcia"), { first: "Maria Clara", middle: "Reyes", last: "Garcia", suffix: "" })
})

test("suffixes are removed before name splitting and fill a separate supported target", () => {
  for (const suffix of ["Jr.", "Sr.", "II", "III"]) {
    assert.deepEqual(splitName(`Alex Taylor Rivera ${suffix}`), { first: "Alex", middle: "Taylor", last: "Rivera", suffix })
    assert.deepEqual(splitName(`Alex Taylor Dela Cruz ${suffix}`), { first: "Alex", middle: "Taylor", last: "Dela Cruz", suffix })
  }
  assert.deepEqual(splitName("Alex Rivera Jr."), { first: "Alex", middle: "", last: "Rivera", suffix: "Jr." })
  assert.deepEqual(splitName(""), { first: "", middle: "", last: "", suffix: "" })
  const layout: Layout = { formId: "synthetic", sha256: "", fillable: false, pages: [], entries: ["first", "middle", "last", "suffix"].map((part) => ({ key: "owner_name", page: 0, x: 0, y: 0, size: 10, part: part as "first" | "middle" | "last" | "suffix" })) }
  assert.deepEqual(initialBoxes(layout, { owner_name: "Alex Taylor Rivera Jr." }).boxes.map((b) => b.text), ["Alex", "Taylor", "Rivera", "Jr."])
})

test("dates print as MM/DD/YYYY", () => {
  assert.equal(formatDate("1980-05-14"), "05/14/1980")
  assert.equal(formatDate("June 23 2026"), "06/23/2026")
})

test("fills every answer with its part, format, cells and fit; marks only matching options", () => {
  const { boxes, signature } = initialBoxes(
    layout,
    { owner_name: "Juana Santos Dela Cruz", tin: "123-456-789-000", birth_date: "1980-05-14", business_name: "Nena's Carinderia and Catering Services", structure: "Sole proprietorship", email: "", mobile: "+639171234567", dti_no: "1234567" },
    new Date("2026-10-22T08:00:00Z")
  )
  const byX = Object.fromEntries(boxes.map((b) => [b.x, b]))
  assert.equal(byX[30].text, "DELA CRUZ")
  assert.equal(byX[130].text, "JUANA")
  assert.equal(boxes.find((b) => b.pitch)?.text, "123456789000")
  assert.equal(boxes.find((b) => b.key === "birth_date")?.text, "05/14/1980")
  assert.ok(boxes.find((b) => b.key === "business_name")!.size < 9) // shrunk to fit 40pt
  assert.deepEqual(boxes.filter((b) => b.kind === "mark").map((b) => b.x), [50, 20])
  assert.equal(boxes.find((b) => b.key === "__today")?.text, "10/22/2026")
  assert.ok(!boxes.some((b) => b.key === "email"))
  assert.deepEqual(signature, { page: 0, x: 200, y: 100, width: 120 })
  assert.equal(boxes.find((b) => b.key === "mobile")?.text, "09171234567") // +63 → 0, one per cell
  assert.ok(boxes.find((b) => b.key === "mobile")?.pitch)
  const dti = boxes.find((b) => b.key === "dti_no")!
  assert.equal(dti.text, "1234567") // not cut to 4 cells…
  assert.equal(dti.pitch, undefined) // …written as normal text instead
})

test("text is made safe for standard PDF fonts", () => {
  assert.equal(pdfSafe("Nena’s Kainan – ₱30 Ñ"), "Nena's Kainan - PHP 30 Ñ")
  assert.equal(pdfSafe("pirma ✍️"), "pirma ")
})
