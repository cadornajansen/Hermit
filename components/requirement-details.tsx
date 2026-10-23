"use client"

import { ArrowUpRight, Check, ExternalLink, Info, MessageCircle } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"

import { DocSlots } from "@/components/doc-slots"
import { RequirementStatus } from "@/components/requirement-row"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { getBlockers, getUncertainPrerequisites } from "@/lib/dashboard-summary"
import { defaultExpiry } from "@/lib/engine"
import { formsFor } from "@/lib/forms"
import { processFor } from "@/lib/processes"
import { update, useProfile } from "@/lib/store"
import { STATUS_LABEL, type ComplianceItem, type Status, type VaultDoc } from "@/lib/types"

const EDITABLE_STATUSES: Status[] = ["not_started", "in_progress", "submitted", "approved"]

export function RequirementDetails({ item, items, docs, onClose }: {
  item: ComplianceItem
  items: ComplianceItem[]
  docs: VaultDoc[]
  onClose: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const blockers = getBlockers(item, items)
  const uncertain = getUncertainPrerequisites(item, items)
  const { profile } = useProfile()
  const forms = formsFor(item.id, profile ?? undefined)
  const start = profile ? processFor(item.id, profile) : undefined

  function setStatus(value: string | null): void {
    if (!value || !EDITABLE_STATUSES.includes(value as Status)) return
    const status = value as Status
    update((saved) => ({ items: {
      ...saved.items,
      [item.id]: { status, expiresOn: status === "approved" ? (item.expiresOn ?? defaultExpiry(item.id)) : item.expiresOn },
    } }))
  }

  function setExpiry(expiresOn: string): void {
    update((saved) => ({ items: {
      ...saved.items,
      [item.id]: { status: item.status, expiresOn: expiresOn || undefined },
    } }))
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent initialFocus={titleRef} className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-xl [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent [&>[data-slot=dialog-close]]:hover:text-primary">
        <header className="flex shrink-0 flex-col gap-3 px-5 pt-6 pb-5 pr-16 sm:px-6 sm:pr-16">
          <span className="text-xs font-medium text-muted-foreground">Requirement details</span>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl leading-snug outline-none">{item.name}</DialogTitle>
          <DialogDescription>{item.agency}</DialogDescription>
          <RequirementStatus status={item.status} />
        </header>
        <Separator />
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 text-sm leading-relaxed [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:px-6">
          <p>{item.explainer}</p>
          {(item.applies === "maybe" || blockers.length > 0 || uncertain.length > 0) && (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle>{item.applies === "maybe" ? "Confirm this requirement" : "Before you continue"}</AlertTitle>
              <AlertDescription>
                {item.applies === "maybe" && <p>Your answers do not yet confirm whether this applies. Check with {item.agency}.</p>}
                {blockers.length > 0 && <p>Complete first: {blockers.map((entry) => entry.name).join(", ")}.</p>}
                {uncertain.length > 0 && <p>Confirm these prerequisites: {uncertain.map((entry) => entry.name).join(", ")}.</p>}
              </AlertDescription>
            </Alert>
          )}
          <section className="flex flex-col gap-3" aria-label="What to prepare">
            <h2 className="font-semibold">What to prepare</h2>
            <ul className="flex flex-col gap-2">
              {item.documents.map((document) => (
                <li key={document} className="flex items-start gap-2.5"><Check className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{document}</span></li>
              ))}
            </ul>
          </section>
          <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3">
            <dt className="text-muted-foreground">Fees</dt><dd>{item.fee}</dd>
            <dt className="text-muted-foreground">Submit to</dt><dd className="break-words">{item.whereToFile}</dd>
            <dt className="text-muted-foreground">Processing</dt><dd>{item.processingTime}</dd>
            <dt className="text-muted-foreground">Renewal</dt><dd>{item.renewal}</dd>
          </dl>
          <DocSlots requirementId={item.id} docs={docs} />
          <Separator />
          <FieldGroup className="gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="requirement-status">Your progress</FieldLabel>
              <Select value={item.status === "expiring" || item.status === "expired" ? "approved" : item.status} onValueChange={setStatus} items={STATUS_LABEL}>
                <SelectTrigger id="requirement-status" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent align="start" sideOffset={8} alignItemWithTrigger={false} className="rounded-xl">
                  <SelectGroup>{EDITABLE_STATUSES.map((status) => <SelectItem key={status} value={status} className="min-h-11">{STATUS_LABEL[status]}</SelectItem>)}</SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {["approved", "expiring", "expired"].includes(item.status) && (
              <Field className="gap-2">
                <FieldLabel htmlFor="requirement-expiry">Document expiry</FieldLabel>
                <Input id="requirement-expiry" type="date" className="rounded-xl" value={item.expiresOn ?? ""} onChange={(event) => setExpiry(event.target.value)} />
              </Field>
            )}
          </FieldGroup>
          {!!start?.links.length && (
            <section className="flex flex-col gap-2" aria-label="Where to start">
              <h2 className="font-semibold">Where to start</h2>
              {start.links.map((l) => (
                <div key={l.url} className="flex flex-col gap-1 text-sm">
                  <a href={l.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "self-start" })}>{l.label}<ExternalLink data-icon="inline-end" /></a>
                  <ol className="list-decimal pl-5 text-muted-foreground">{l.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                </div>
              ))}
              {start.note && <p className="text-xs text-muted-foreground">{start.note}</p>}
            </section>
          )}
          {forms.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Related forms">
              <h2 className="font-semibold">Related forms</h2>
              <div className="flex flex-wrap gap-2">{forms.map((f) => (
                <Link key={f.id} href={`/forms/${f.id}`} className={buttonVariants({ variant: "outline" })}>Pre-fill {f.short}<ArrowUpRight data-icon="inline-end" /></Link>
              ))}</div>
            </section>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {item.lastVerified ? `Source reviewed ${item.lastVerified}.` : "Source not yet reviewed for your city. Confirm the details with the issuing office."}
            {item.optional ? " This is an optional registration or benefit." : ""}
          </p>
        </div>
        <Separator />
        <footer className="flex shrink-0 flex-wrap gap-2 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={buttonVariants()}><ExternalLink data-icon="inline-start" />Official source</a>
          <Link href={`/assistant?q=${encodeURIComponent(`What do I need to prepare for ${item.name}?`)}`} className={buttonVariants({ variant: "outline" })}><MessageCircle data-icon="inline-start" />Ask Hermit</Link>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
