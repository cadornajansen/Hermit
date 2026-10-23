// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { agencyRecord, appointmentSlots } from "./agencies.ts"

const owner = { ownerName: "Juana Dela Cruz", businessName: "Nena's Carinderia", employees: "1_9", structure: "sole" }
const today = new Date(2026, 9, 23) // Fri, Oct 23 2026

test("sample agency records are stable per owner and always marked demo", () => {
  const a = agencyRecord("sss", owner, today)
  assert.deepEqual(agencyRecord("sss", owner, today), a)
  assert.equal(a.demo, true)
  assert.match(a.number, /^\d{2}-\d{7}-\d$/)
  assert.equal(a.rows.length, 3)
  assert.match(a.rows[0].label, /September 2026/)
  assert.notEqual(agencyRecord("sss", { ...owner, ownerName: "Pedro Santos" }, today).number, a.number)
  assert.match(agencyRecord("philhealth", owner, today).number, /^\d{2}-\d{9}-\d$/)
  assert.match(agencyRecord("pagibig", owner, today).number, /^\d{4}-\d{4}-\d{4}$/)
})

test("appointment slots skip weekends and days already booked", () => {
  const slots = appointmentSlots("BIR RDO 44", [], today)
  assert.equal(slots.length, 3)
  for (const s of slots) assert.ok(![0, 6].includes(new Date(`${s.at}:00`).getDay()), s.at)
  const booked = appointmentSlots("BIR RDO 44", [{ at: `${slots[0].at.slice(0, 10)}T09:00` }], today)
  assert.ok(!booked.some((s) => s.at.startsWith(slots[0].at.slice(0, 10))))
})
