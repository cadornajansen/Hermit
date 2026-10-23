import type { Deadline } from "./types"

export type CalendarEvent = Deadline & { maybe: boolean }
export type CalendarDay = { date: string; day: number; inMonth: boolean }
export type CalendarRange = { start: string; end: string; firstMonth: string; lastMonth: string }

const DAY = 86_400_000

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

// Engine dates are calendar days, not instants in the viewer's time zone.
export function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function shiftCalendarDay(date: string, days: number): string {
  return new Date(utcDate(date).getTime() + days * DAY).toISOString().slice(0, 10)
}

export function shiftCalendarMonth(month: string, months: number): string {
  const date = utcDate(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 7)
}

export function calendarRange(from: Date, months = 12): CalendarRange {
  const start = calendarDayKey(from)
  const end = new Date(Date.UTC(from.getFullYear(), from.getMonth() + months, from.getDate())).toISOString().slice(0, 10)
  return { start, end, firstMonth: start.slice(0, 7), lastMonth: shiftCalendarDay(end, -1).slice(0, 7) }
}

export function monthDays(month: string): CalendarDay[] {
  const first = utcDate(`${month}-01`)
  const start = shiftCalendarDay(`${month}-01`, -first.getUTCDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = shiftCalendarDay(start, index)
    return { date, day: Number(date.slice(-2)), inMonth: date.startsWith(month) }
  })
}

export function groupCalendarEvents(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const day = grouped.get(event.due)
    if (day) day.push(event)
    else grouped.set(event.due, [event])
  }
  return grouped
}

export function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-PH", { ...options, timeZone: "UTC" }).format(utcDate(date))
}

export function googleCalendarUrl(event: Deadline): string {
  const compact = (date: string): string => date.replaceAll("-", "")
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.title} (${event.form})`,
    dates: `${compact(event.due)}/${compact(shiftCalendarDay(event.due, 1))}`,
    details: "Reminder from HERMIT. Confirm the date with the issuing office.",
  })
  return `https://calendar.google.com/calendar/render?${query}`
}
