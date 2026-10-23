import assert from "node:assert/strict"
import { test } from "node:test"

import {
  calendarDayKey, calendarRange, formatCalendarDate, googleCalendarUrl,
  groupCalendarEvents, monthDays, shiftCalendarDay, shiftCalendarMonth,
  type CalendarEvent,
} from "./calendar-view.ts"

test("months starting on Sunday and Saturday always produce six Sunday-first weeks", () => {
  const sunday = monthDays("2026-02")
  const saturday = monthDays("2026-08")
  assert.equal(sunday.length, 42)
  assert.equal(sunday[0].date, "2026-02-01")
  assert.equal(sunday[0].inMonth, true)
  assert.equal(saturday[0].date, "2026-07-26")
  assert.equal(saturday[0].inMonth, false)
  assert.equal(saturday[6].date, "2026-08-01")
  for (const days of [sunday, saturday]) {
    assert.equal(new Date(`${days[0].date}T00:00:00Z`).getUTCDay(), 0)
    assert.equal(new Set(days.map((day) => day.date)).size, 42)
  }
})

test("leap February and December grids preserve actual dates across year boundaries", () => {
  assert.equal(monthDays("2028-02").filter((day) => day.inMonth).length, 29)
  assert.equal(monthDays("2027-02").filter((day) => day.inMonth).length, 28)
  assert.equal(monthDays("2026-12").at(-1)?.date, "2027-01-09")
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01")
  assert.equal(shiftCalendarMonth("2027-01", -1), "2026-12")
  assert.equal(shiftCalendarDay("2028-02-28", 1), "2028-02-29")
})

test("navigation covers the engine's exclusive rolling end, including its last partial month", () => {
  assert.deepEqual(calendarRange(new Date(2026, 9, 23)), {
    start: "2026-10-23", end: "2027-10-23", firstMonth: "2026-10", lastMonth: "2027-10",
  })
  assert.equal(calendarRange(new Date(2026, 9, 1)).lastMonth, "2027-09")
  assert.equal(calendarRange(new Date(2028, 1, 29)).end, "2029-03-01")
})

test("grouping retains same-day events, IDs, uncertainty and input order without mutating events", () => {
  const first: CalendarEvent = { id: "tax:2026-10-26", due: "2026-10-26", title: "Tax", form: "2551Q", maybe: true, note: "Confirm first" }
  const second: CalendarEvent = { id: "expiry:dti_bn", due: "2026-10-26", title: "Renew", form: "DTI", maybe: false }
  const later: CalendarEvent = { id: "later", due: "2026-11-02", title: "Later", form: "SSS", maybe: false }
  const events = Object.freeze([Object.freeze(first), Object.freeze(second), Object.freeze(later)])
  const grouped = groupCalendarEvents(events)
  assert.deepEqual(grouped.get("2026-10-26"), [first, second])
  assert.equal(grouped.get("2026-10-26")?.[0], first)
  assert.equal(grouped.get("2026-10-27"), undefined)
  assert.equal(groupCalendarEvents([]).size, 0)
})

test("date keys use the local engine day while ISO labels never shift by viewer time zone", () => {
  assert.equal(calendarDayKey(new Date(2026, 9, 23, 23, 59)), "2026-10-23")
  assert.equal(formatCalendarDate("2026-01-01", { month: "long", day: "numeric", year: "numeric" }), "January 1, 2026")
  assert.equal(formatCalendarDate("2026-01-01", { day: "numeric", timeZone: "America/Los_Angeles" }), "1")
})

test("Google all-day links use the next calendar day as their exclusive end", () => {
  for (const [due, dates] of [
    ["2026-12-31", "20261231/20270101"],
    ["2028-02-28", "20280228/20280229"],
    ["2028-02-29", "20280229/20280301"],
  ]) {
    const url = new URL(googleCalendarUrl({ id: "test", title: "Tax & return", form: "2551Q", due }))
    assert.equal(url.searchParams.get("dates"), dates)
    assert.equal(url.searchParams.get("text"), "Tax & return (2551Q)")
  }
})
