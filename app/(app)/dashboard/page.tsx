"use client"

import { AlertTriangle, ExternalLink, X } from "lucide-react"
import Link from "next/link"

import { DocSlots } from "@/components/doc-slots"
import { buttonVariants } from "@/components/ui/button"
import { buildCalendar, buildChecklist, defaultExpiry, healthScore } from "@/lib/engine"
import { formsFor } from "@/lib/forms"
import { processFor } from "@/lib/processes"
import { update, useProfile } from "@/lib/store"
import { STATUS_LABEL, type ComplianceItem, type Group, type Status } from "@/lib/types"
import { cn } from "@/lib/utils"

const GROUPS: [Group, string][] = [
  ["start", "Simulan · Start"],
  ["operate", "Patakbuhin · Operate"],
  ["hire", "Mag-hire · Hire"],
  ["renew", "I-renew · Renew"],
]

const STATUS_TONE: Record<Status, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  submitted: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  approved: "bg-primary/15 text-primary",
  expiring: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  expired: "bg-destructive/15 text-destructive",
}

export default function Dashboard() {
  const { profile, items: states, lastDiff, docs } = useProfile()
  if (!profile) return null

  const items = buildChecklist(profile, states)
  const { done, total } = healthScore(items)
  const next = buildCalendar(profile, items).slice(0, 3)
  const names = new Map(items.map((i) => [i.id, i]))

  function setStatus(item: ComplianceItem, status: Status) {
    update((s) => ({
      items: {
        ...s.items,
        [item.id]: {
          status,
          expiresOn: status === "approved" ? (item.expiresOn ?? defaultExpiry(item.id)) : item.expiresOn,
        },
      },
    }))
  }
  function setExpiry(item: ComplianceItem, expiresOn: string) {
    update((s) => ({ items: { ...s.items, [item.id]: { status: item.status, expiresOn: expiresOn || undefined } } }))
  }

  return (
    <div className="flex flex-col gap-6">
      {lastDiff && (lastDiff.added.length > 0 || lastDiff.removed.length > 0) && (
        <div className="relative rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <button className="absolute top-3 right-3" aria-label="Isara" onClick={() => update(() => ({ lastDiff: null }))}>
            <X className="size-4" />
          </button>
          {lastDiff.added.length > 0 && (
            <p>
              Dahil sa pagbabago mo, <strong>{lastDiff.added.length} bagong item</strong>: {lastDiff.added.join(", ")}.
            </p>
          )}
          {lastDiff.removed.length > 0 && <p className="text-muted-foreground">Inalis: {lastDiff.removed.join(", ")}.</p>}
        </div>
      )}

      {profile.stage === "operating_unregistered" && (
        <div className="rounded-2xl bg-muted p-4 text-sm">
          <p className="font-medium">Okay lang &apos;yan — maraming negosyo ang nagsisimula nang ganito.</p>
          <p className="text-muted-foreground">
            Sundan lang ang checklist mula sa itaas. Kung may penalty para sa nakaraan, ang Negosyo Center at ang RDO mo
            ang makakapagsabi ng tamang catch-up steps at kung may amnesty program.
          </p>
        </div>
      )}

      <section className="rounded-2xl border p-5">
        <p className="text-sm text-muted-foreground">{profile.businessName || "Ang negosyo mo"}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {done} <span className="text-lg font-normal text-muted-foreground">of {total} done</span>
        </p>
        <div
          className="mt-3 h-2 rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemax={total}
          aria-label="Compliance progress"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        {next.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {next.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span>
                  {d.title} <span className="text-muted-foreground">· {d.form}</span>
                </span>
                <span className="shrink-0 tabular-nums">{d.due}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/calendar" className="mt-2 inline-block text-sm text-primary">
          Buong kalendaryo →
        </Link>
      </section>

      {GROUPS.map(([g, title]) => {
        const list = items.filter((i) => i.group === g)
        if (!list.length) return null
        return (
          <section key={g} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
            {list.map((item) => {
              const blockers = item.prerequisites
                .map((id) => names.get(id))
                .filter((r) => r && r.applies === true && r.status !== "approved" && r.status !== "expiring")
              return (
                <details key={item.id} className="group rounded-2xl border">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.agency}</span>
                      {item.applies === "maybe" && (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          Possibly required — confirm with {item.agency}
                        </span>
                      )}
                      {item.optional && <span className="text-xs text-primary">Optional, pero sulit</span>}
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", STATUS_TONE[item.status])}>
                      {STATUS_LABEL[item.status].split(" · ").pop()}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t p-4 text-sm">
                    <p>{item.explainer}</p>
                    {blockers.length > 0 && (
                      <p className="text-amber-700 dark:text-amber-400">
                        Unahin muna: {blockers.map((b) => b!.name).join(", ")}
                      </p>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                      <dt className="text-muted-foreground">Dalhin</dt>
                      <dd>
                        <ul className="list-disc pl-4">
                          {item.documents.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </dd>
                      <dt className="text-muted-foreground">Bayad</dt>
                      <dd>{item.fee}</dd>
                      <dt className="text-muted-foreground">Saan</dt>
                      <dd className="break-words">{item.whereToFile}</dd>
                      <dt className="text-muted-foreground">Renewal</dt>
                      <dd>{item.renewal}</dd>
                    </dl>
                    <StartHere requirementId={item.id} profile={profile} />
                    <DocSlots requirementId={item.id} docs={docs} />
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {item.lastVerified
                        ? `Verified ${item.lastVerified}`
                        : "Not yet verified for your city — confirm with the office."}{" "}
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary">
                        Source <ExternalLink className="size-3" />
                      </a>
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-1 text-xs">
                        Status
                        <select
                          className="h-9 rounded-lg border bg-background px-2 text-sm"
                          value={item.status === "expiring" || item.status === "expired" ? "approved" : item.status}
                          onChange={(e) => setStatus(item, e.target.value as Status)}
                        >
                          {(["not_started", "in_progress", "submitted", "approved"] as Status[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {["approved", "expiring", "expired"].includes(item.status) && (
                        <label className="flex flex-col gap-1 text-xs">
                          Expires
                          <input
                            type="date"
                            className="h-9 rounded-lg border bg-background px-2 text-sm"
                            value={item.expiresOn ?? ""}
                            onChange={(e) => setExpiry(item, e.target.value)}
                          />
                        </label>
                      )}
                      {formsFor(item.id, profile).map((f) => (
                        <Link key={f.id} href={`/forms/${f.id}`} className={buttonVariants({ size: "sm" })}>
                          Pre-fill {f.short}
                        </Link>
                      ))}
                      <Link
                        href={`/assistant?q=${encodeURIComponent(`Ano ang kailangan para sa ${item.name}?`)}`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Tanong kay Kuya Hermit
                      </Link>
                    </div>
                  </div>
                </details>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

// Exactly where to begin the paperwork for steps without a downloadable form.
function StartHere({ requirementId, profile }: { requirementId: string; profile: import("@/lib/types").Profile }) {
  const p = processFor(requirementId, profile)
  if (!p || (!p.links.length && !p.office)) return null
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-primary/5 p-3">
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">Simulan dito · Start here</p>
      <p className="text-xs">Jurisdiction: {p.jurisdiction}</p>
      {p.links.map((l) => (
        <div key={l.label} className="flex flex-col gap-1">
          <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
            {l.label} <ExternalLink className="size-3.5" />
          </a>
          <span className="text-xs break-all text-muted-foreground">{l.url}</span>
          <ol className="list-decimal pl-5 text-xs">
            {l.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ))}
      {p.office && <p className="text-xs">Opisina: {p.office}</p>}
      {p.note && <p className="text-xs text-amber-700 dark:text-amber-400">{p.note}</p>}
      <p className="text-[11px] text-muted-foreground">Na-check ni Hermit ang mga link noong {p.verifiedOn}.</p>
    </div>
  )
}
