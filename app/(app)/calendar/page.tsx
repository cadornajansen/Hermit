"use client"

import { useState, useTransition } from "react"

import { sendReminderSms } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildCalendar, buildChecklist, reminderDates } from "@/lib/engine"
import { useProfile } from "@/lib/store"
import type { Deadline } from "@/lib/types"

const month = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" })

// All-day event link; no OAuth needed.
function googleCalendarUrl(d: Deadline) {
  const day = d.due.replaceAll("-", "")
  const next = new Date(Date.parse(d.due) + 86_400_000).toISOString().slice(0, 10).replaceAll("-", "")
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${d.title} (${d.form})`,
    dates: `${day}/${next}`,
    details: "Reminder from HERMIT. Open HERMIT for your pre-filled form and office.",
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

export default function CalendarPage() {
  const { profile, items } = useProfile()
  const [sent, setSent] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  if (!profile) return null

  const deadlines = buildCalendar(profile, buildChecklist(profile, items))
  const byMonth = Map.groupBy(deadlines, (d) => month(d.due))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kalendaryo</h1>
        <p className="text-sm text-muted-foreground">
          Susunod na 12 buwan. Paalala 14 araw bago, 3 araw bago, at sa mismong araw
          {profile.reminders.length ? ` via ${profile.reminders.join(" + ").toUpperCase()}` : ""}. Weekend dates move to
          Monday; check BIR for holiday extensions.
        </p>
      </div>
      {deadlines.length === 0 && <p className="text-sm">Walang deadline sa susunod na 12 buwan.</p>}
      {[...byMonth].map(([m, list]) => (
        <section key={m} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{m}</h2>
          {list.map((d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-2xl border p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{d.title}</span>
                  <span className="block text-xs text-muted-foreground">{d.form}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{d.due}</span>
              </div>
              {d.maybe && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Possibly applies — depends on an answer you marked &quot;Hindi ko alam&quot;.</p>
              )}
              {d.note && <p className="text-xs text-muted-foreground">{d.note}</p>}
              <p className="text-xs text-muted-foreground">Paalala: {reminderDates(d.due).join(", ")}</p>
              <div className="flex flex-wrap gap-2">
                <a href={googleCalendarUrl(d)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Add to Google Calendar
                </a>
                {profile.reminders.includes("sms") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await sendReminderSms({ title: d.title, due: d.due, mobile: profile.mobile })
                        setSent((s) => ({ ...s, [d.id]: r.ok ? "SMS sent ✓" : (r.error ?? "Failed") }))
                      })
                    }
                  >
                    Send SMS reminder now
                  </Button>
                )}
              </div>
              {sent[d.id] && <p className="text-xs">{sent[d.id]}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
