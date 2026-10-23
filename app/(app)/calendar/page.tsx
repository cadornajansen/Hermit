"use client"

import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Info, Send } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState, useSyncExternalStore, useTransition, type KeyboardEvent } from "react"

import { sendReminderSms } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  calendarDayKey, calendarRange, formatCalendarDate, googleCalendarUrl,
  groupCalendarEvents, monthDays, shiftCalendarDay, shiftCalendarMonth,
  type CalendarEvent,
} from "@/lib/calendar-view"
import { buildCalendar, buildChecklist, reminderDates } from "@/lib/engine"
import { PAYABLES } from "@/lib/payments"
import { currentStorageKey, useProfile } from "@/lib/store"
import type { ItemState, Profile } from "@/lib/types"

type CalendarView = "month" | "agenda"
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function subscribeToMobile(onChange: () => void): () => void {
  const query = window.matchMedia("(max-width: 767px)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

const isMobile = (): boolean => window.matchMedia("(max-width: 767px)").matches
const serverMobile = (): boolean => false
const dateLabel = (date: string): string => formatCalendarDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
const eventTone = (event: CalendarEvent): string => event.maybe
  ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
  : event.id.startsWith("expiry:")
    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    : "bg-secondary text-secondary-foreground"

export default function CalendarPage() {
  const { profile, items } = useProfile()
  if (!profile) return null
  return <CalendarWorkspace key={currentStorageKey()} profile={profile} items={items} />
}

function CalendarWorkspace({ profile, items }: { profile: Profile; items: Record<string, ItemState> }) {
  const [today] = useState(() => new Date())
  const range = calendarRange(today)
  const todayKey = calendarDayKey(today)
  const [month, setMonth] = useState(range.firstMonth)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [chosenView, setChosenView] = useState<CalendarView | null>(null)
  const mobile = useSyncExternalStore(subscribeToMobile, isMobile, serverMobile)
  const view = chosenView ?? (mobile ? "agenda" : "month")
  const deadlines = useMemo(() => buildCalendar(profile, buildChecklist(profile, items), today), [profile, items, today])
  const byDate = groupCalendarEvents(deadlines)
  const monthlyEvents = deadlines.filter((event) => event.due.startsWith(month))
  const days = monthDays(month)
  const selectedEvent = deadlines.find((event) => event.id === selectedEventId)
  const dateButtons = useRef(new Map<string, HTMLButtonElement>())
  const dayAgenda = useRef<HTMLElement>(null)
  const monthLabel = formatCalendarDate(`${month}-01`, { month: "long", year: "numeric" })

  function selectDate(date: string): void {
    if (date < range.start || date >= range.end) return
    setSelectedDate(date)
    setMonth(date.slice(0, 7))
  }

  function navigateMonth(offset: number): void {
    const next = shiftCalendarMonth(month, offset)
    if (next < range.firstMonth || next > range.lastMonth) return
    const first = `${next}-01`
    setMonth(next)
    setSelectedDate(first < range.start ? range.start : first)
  }

  function showDayAgenda(date: string): void {
    selectDate(date)
    requestAnimationFrame(() => dayAgenda.current?.scrollIntoView({ block: "nearest" }))
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string): void {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = shiftCalendarDay(date, offset)
    if (next < range.start || next >= range.end) return
    selectDate(next)
    requestAnimationFrame(() => dateButtons.current.get(next)?.focus())
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <Link href="/hub" className={buttonVariants({ variant: "outline" })}>File &amp; pay</Link>
      </header>

      {!!profile.appointments?.length && (
        <section aria-labelledby="calendar-appointments" className="flex flex-col gap-3">
          <h2 id="calendar-appointments" className="text-sm font-semibold">Appointments</h2>
          {[...profile.appointments].sort((first, second) => first.at.localeCompare(second.at)).map((appointment) => (
            <div key={appointment.id} className="flex flex-wrap justify-between gap-3 rounded-2xl border bg-background p-4 text-sm">
              <div>
                <p className="font-medium">{appointment.purpose}</p>
                <p className="mt-1 text-xs text-muted-foreground">{appointment.office} · booked through Kuya Hermit (prototype)</p>
              </div>
              <time dateTime={appointment.at} className="shrink-0 font-medium tabular-nums">{appointment.at.replace("T", " ")}</time>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" aria-label="Previous month" disabled={month === range.firstMonth} onClick={() => navigateMonth(-1)}><ChevronLeft /></Button>
            <Button variant="ghost" onClick={() => selectDate(todayKey)}>Today</Button>
            <Button variant="ghost" size="icon" aria-label="Next month" disabled={month === range.lastMonth} onClick={() => navigateMonth(1)}><ChevronRight /></Button>
          </div>
          <h2 aria-live="polite" className="text-base font-semibold sm:ml-2">{monthLabel}</h2>
        </div>
        <div role="group" aria-label="Calendar view" className="flex rounded-xl border bg-background p-1">
          {(["month", "agenda"] as const).map((option) => (
            <Button key={option} variant="ghost" aria-pressed={view === option} className={`rounded-lg px-4 ${view === option ? "bg-muted text-foreground" : "text-muted-foreground"}`} onClick={() => setChosenView(option)}>
              {option === "month" ? "Month" : "Agenda"}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4" aria-label="Event types">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />Generated</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-emerald-600" />Recorded expiry</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />Confirm</span>
        </div>
        <span className="flex items-center gap-1.5"><Info aria-hidden="true" className="size-3.5" />Confirm dates with the issuing office.</span>
      </div>

      {view === "month" ? (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-background shadow-sm">
          <div role="grid" aria-label={monthLabel} className="min-w-[364px]">
            <div role="row" className="grid grid-cols-7 border-b">
              {WEEKDAYS.map((day) => <div role="columnheader" key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">{day}</div>)}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7 not-last:border-b">
                {days.slice(week * 7, week * 7 + 7).map((day) => {
                  const events = byDate.get(day.date) ?? []
                  const disabled = day.date < range.start || day.date >= range.end
                  return (
                    <div role="gridcell" aria-selected={day.date === selectedDate} key={day.date} className={`min-h-28 min-w-0 p-1 not-last:border-r sm:p-2 ${day.inMonth ? "" : "bg-muted/50"} ${day.date === selectedDate ? "bg-primary/[0.025]" : ""}`}>
                      <Button
                        ref={(node) => { if (node) dateButtons.current.set(day.date, node); else dateButtons.current.delete(day.date) }}
                        variant="ghost" size="icon" disabled={disabled} tabIndex={day.date === selectedDate ? 0 : -1}
                        aria-label={`${dateLabel(day.date)}, ${events.length} ${events.length === 1 ? "event" : "events"}`}
                        aria-current={day.date === todayKey ? "date" : undefined}
                        onClick={() => showDayAgenda(day.date)} onKeyDown={(event) => onDayKeyDown(event, day.date)}
                        className={`mb-0.5 text-xs ${day.date === selectedDate ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : day.date === todayKey ? "font-semibold text-primary" : day.inMonth ? "" : "text-muted-foreground"}`}
                      >{day.day}</Button>
                      <div className="flex flex-col">
                        {events.slice(0, 2).map((event) => (
                          <button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className="flex min-h-11 w-full min-w-0 items-center rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${event.title}, ${dateLabel(event.due)}`}>
                            <span className={`block w-full truncate rounded-md px-1.5 py-1 text-xs leading-snug ${eventTone(event)}`}>{event.title}</span>
                          </button>
                        ))}
                        {events.length > 2 && <button type="button" className="min-h-11 rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" onClick={() => showDayAgenda(day.date)} aria-label={`Show all ${events.length} events on ${dateLabel(day.date)}`}>+{events.length - 2} more</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          </div>
          <section ref={dayAgenda} aria-labelledby="selected-day" className="scroll-mt-4 overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
            <h2 id="selected-day" aria-live="polite" className="border-b px-5 py-4 text-sm font-semibold">{formatCalendarDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h2>
            <EventList events={byDate.get(selectedDate) ?? []} onSelect={setSelectedEventId} empty="No events on this date." />
          </section>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
          {monthlyEvents.length === 0 ? <CalendarEmpty label="No events this month." /> : [...groupCalendarEvents(monthlyEvents)].map(([date, events]) => (
            <section key={date} aria-label={dateLabel(date)} className="not-last:border-b">
              <h3 className="bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground">{formatCalendarDate(date, { weekday: "long", month: "short", day: "numeric" })}</h3>
              <EventList events={events} onSelect={setSelectedEventId} empty="No events on this date." />
            </section>
          ))}
        </div>
      )}

      {selectedEvent && <EventDetails key={selectedEvent.id} event={selectedEvent} profile={profile} onClose={() => setSelectedEventId(null)} />}
    </div>
  )
}

function CalendarEmpty({ label }: { label: string }) {
  return <Empty className="min-h-40 p-6"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia><EmptyTitle className="text-sm">{label}</EmptyTitle></EmptyHeader></Empty>
}

function EventList({ events, onSelect, empty }: { events: CalendarEvent[]; onSelect: (id: string) => void; empty: string }) {
  if (events.length === 0) return <CalendarEmpty label={empty} />
  return <div className="divide-y">{events.map((event) => (
    <button key={event.id} type="button" className="flex min-h-20 w-full items-center gap-3 px-5 py-4 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => onSelect(event.id)}>
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${eventTone(event)}`}><CalendarDays className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-medium">{event.title}</span>{event.maybe && <Badge className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Confirm</Badge>}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{event.form}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </button>
  ))}</div>
}

function EventDetails({ event, profile, onClose }: { event: CalendarEvent; profile: Profile; onClose: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const payable = PAYABLES.find((item) => item.deadlineId === event.id.split(":")[0])
  const recorded = event.id.startsWith("expiry:")

  function sendSms(): void {
    const scope = currentStorageKey()
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await sendReminderSms({ title: event.title, due: event.due, mobile: profile.mobile })
        if (currentStorageKey() !== scope) return
        setMessage({ ok: result.ok, text: result.ok ? "SMS sent." : (result.error ?? "Could not send SMS. Try again.") })
      } catch {
        if (currentStorageKey() === scope) setMessage({ ok: false, text: "Could not send SMS. Try again." })
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent initialFocus={titleRef} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[720px] [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent [&>[data-slot=dialog-close]]:hover:text-primary">
        <header className="flex shrink-0 flex-col gap-2 border-b px-5 py-5 pr-16 sm:px-6 sm:pr-16">
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl leading-snug outline-none">{event.title}</DialogTitle>
          <DialogDescription>{event.form}</DialogDescription>
        </header>
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 text-sm [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{recorded ? "Recorded expiry" : "Generated date"}</Badge>
            {event.maybe && <Badge className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Confirm</Badge>}
          </div>
          <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-4">
            <dt className="text-muted-foreground">Due</dt><dd className="font-medium">{dateLabel(event.due)}</dd>
            <dt className="text-muted-foreground">Reminders</dt><dd className="flex flex-wrap gap-2">{reminderDates(event.due).map((date) => <span key={date} className="rounded-md bg-muted px-2 py-1 text-xs">{formatCalendarDate(date, { month: "short", day: "numeric", year: "numeric" })}</span>)}</dd>
          </dl>
          {event.note && <p className="text-sm leading-relaxed text-muted-foreground">{event.note}</p>}
          {message && <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}
        </div>
        <footer className="flex shrink-0 flex-wrap gap-2 border-t px-5 py-4 sm:px-6">
          {payable && <Link href={`/pay?form=${payable.formId}`} className={buttonVariants()}>Pay</Link>}
          <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: payable ? "outline" : "default" })}><ExternalLink data-icon="inline-start" />Google Calendar</a>
          {profile.reminders.includes("sms") && <Button variant="outline" disabled={pending} onClick={sendSms}><Send data-icon="inline-start" />{pending ? "Sending…" : message && !message.ok ? "Retry SMS" : "Send SMS"}</Button>}
        </footer>
      </DialogContent>
    </Dialog>
  )
}
