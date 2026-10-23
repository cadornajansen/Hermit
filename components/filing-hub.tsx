"use client"

import { Calculator, FileText, MessageCircle, Receipt } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { listPayments, type PaymentView } from "@/app/pay"
import { listSubmissions } from "@/app/submit"
import { FileButton, SubmissionTracker } from "@/components/submission-tracker"
import { buttonVariants } from "@/components/ui/button"
import { buildCalendar, buildChecklist } from "@/lib/engine"
import { PAYABLES, peso } from "@/lib/payments"
import { useProfile } from "@/lib/store"
import type { Submission } from "@/lib/submissions"
import { coverage, DOC_TYPES } from "@/lib/vault"

// One place to file, pay and track everything, the way it will work once the
// agencies are connected: compute → pay → file → track.
export function FilingHub() {
  const { profile, items, docs } = useProfile()
  const [filed, setFiled] = useState<Submission[]>()
  const [payments, setPayments] = useState<PaymentView[]>([])
  useEffect(() => {
    listSubmissions().then(setFiled, () => setFiled([]))
    listPayments().then(setPayments, () => {})
  }, [])
  if (!profile) return null

  const checklist = buildChecklist(profile, items)
  const due = buildCalendar(profile, checklist, new Date(), 3)
    .map((d) => ({ d, pay: PAYABLES.find((p) => p.deadlineId === d.id.split(":")[0]) }))
    .filter((x) => x.pay)
    .slice(0, 6)
  const applications = checklist.filter(
    (i) => (i.group === "start" || i.group === "hire") && i.applies !== false && !["submitted", "approved"].includes(i.status) && !filed?.some((f) => f.requirementId === i.id)
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">File & pay</h1>
        <p className="text-sm text-muted-foreground">Compute, pay, file and track every return and application in one place.</p>
        <p className="self-start rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-800 dark:text-amber-300">
          Prototype: payments run on eGovPay test mode or a demo QR, and filings are demo until the agencies are connected.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Due soon</h2>
        {due.length === 0 && <p className="text-sm text-muted-foreground">No tax returns due in the next 3 months.</p>}
        <ul className="flex flex-col gap-2">
          {due.map(({ d, pay }) => (
            <li key={d.id} className="flex flex-col gap-3 rounded-2xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-muted-foreground">
                  BIR {pay!.code} · due {d.due}
                  {d.maybe ? " · possibly applies" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/pay?form=${pay!.formId}`} className={buttonVariants({ size: "sm" })}>
                  <Calculator /> Compute, pay & file
                </Link>
                <Link href={`/forms/${pay!.formId}/fill`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  <FileText /> Fill the return
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Applications to submit</h2>
        {applications.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting. Filed applications show below.</p>}
        <ul className="flex flex-col gap-2">
          {applications.slice(0, 8).map((i) => {
            const slots = coverage(i.id, docs)?.needs ?? []
            const ready = slots.filter((s) => s.doc && s.doc.verdict !== "rejected")
            const missing = slots.filter((s) => !(s.doc && s.doc.verdict !== "rejected"))
            return (
              <li key={i.id} className="flex flex-col gap-3 rounded-2xl border bg-background p-4">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {i.agency}
                    {i.applies === "maybe" ? " · possibly required" : ""}
                  </p>
                </div>
                {slots.length > 0 && (
                  <p className="text-sm">
                    Documents: {ready.length} of {slots.length} in your vault
                    {missing.length > 0 && (
                      <span className="block text-xs text-amber-700 dark:text-amber-400">Missing: {missing.map((s) => s.types.map((t) => DOC_TYPES[t].name).join(" / ")).join("; ")}</span>
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/assistant?q=${encodeURIComponent(`Oo, ihanda mo ang mga dokumento para sa ${i.name}`)}`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    <MessageCircle /> Prepare with Kuya Hermit
                  </Link>
                  {missing.length > 0 && (
                    <Link href="/vault" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                      Upload missing
                    </Link>
                  )}
                </div>
                <FileButton kind="application" requirementId={i.id} label={`Submit ${i.name} (demo)`} />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Filed</h2>
        {filed === undefined ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : filed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing filed yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filed.map((s) => (
              <SubmissionTracker key={s.refNo} s={s} />
            ))}
          </div>
        )}
      </section>

      {payments.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Payments</h2>
          <ul className="flex flex-col divide-y rounded-2xl border bg-background text-sm">
            {payments.map((p) => (
              <li key={p.txnid} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    <Receipt className="size-4 shrink-0" /> {p.description}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.createdAt.slice(0, 10)} · {p.status}
                    {p.demo ? " · demo" : p.status === "paid" ? " · eGovPay test" : ""}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{peso(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
