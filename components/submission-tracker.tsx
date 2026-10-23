"use client"

import { Check, Loader2, Send } from "lucide-react"
import { useEffect, useState } from "react"

import { submitFiling } from "@/app/submit"
import { Button } from "@/components/ui/button"
import { update } from "@/lib/store"
import { track, type Submission, type SubmissionKind } from "@/lib/submissions"
import { cn } from "@/lib/utils"

// Time today, date otherwise.
const when = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

// Live status of one filing. Re-checks every few seconds while it moves.
export function SubmissionTracker({ s }: { s: Submission }) {
  const [now, setNow] = useState(() => Date.now())
  const t = track(s.kind, s.createdAt, now)
  useEffect(() => {
    if (t.finished) return
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [t.finished])
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{s.title}</p>
          <p className="text-xs text-muted-foreground">
            {s.agency}
            {s.period ? ` · ${s.period}` : ""}
          </p>
        </div>
        {s.demo && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Demo filing</span>}
      </div>
      <p className="font-mono text-xs">Ref. {s.refNo}</p>
      <ol className="flex flex-col gap-2">
        {t.steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2">
            <span className={cn("flex size-4 items-center justify-center rounded-full", step.done ? "bg-emerald-600 text-white" : "border")}>
              {step.done && <Check className="size-3" />}
            </span>
            <span className={step.done ? undefined : "text-muted-foreground"}>{step.label}</span>
            {step.done && <span className="ml-auto text-xs text-muted-foreground">{when(step.at)}</span>}
          </li>
        ))}
      </ol>
      {s.demo && (
        <p className="text-xs text-muted-foreground">
          Prototype: agencies aren&apos;t connected yet, so this shows how filing will work. File with the agency too until they are.
        </p>
      )}
    </div>
  )
}

// One tap to file: a return (after payment) or an application (with the packet).
export function FileButton({
  kind,
  label,
  formId,
  requirementId,
  period,
  paymentTxnid,
}: {
  kind: SubmissionKind
  label: string
  formId?: string
  requirementId?: string
  period?: string
  paymentTxnid?: string
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Submission>()
  const [error, setError] = useState<string>()
  if (done) return <SubmissionTracker s={done} />
  return (
    <div className="flex flex-col gap-1">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(undefined)
          const r = await submitFiling({ kind, formId, requirementId, period, paymentTxnid }).catch(() => ({ ok: false as const, error: "Hindi na-file. Subukan ulit." }))
          setBusy(false)
          if (!r.ok) return setError(r.error)
          setDone(r.submission)
          // The checklist shows it as submitted right away.
          if (requirementId) update((st) => ({ items: { ...st.items, [requirementId]: { ...st.items[requirementId], status: "submitted" } } }))
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Send />} {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
