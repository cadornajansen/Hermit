"use client"

import { ArrowUpRight, Search } from "lucide-react"
import Link from "next/link"
import { useState, type ReactElement } from "react"

import { AgencyMark } from "@/components/agency-mark"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { buildChecklist } from "@/lib/engine"
import { fillForm, fitsProfile, FORMS, HANDOFF_LABEL, type FormTemplate } from "@/lib/forms"
import { hasLibraryCopy } from "@/lib/library"
import { useProfile } from "@/lib/store"

const GROUPS: [FormTemplate["group"], string][] = [
  ["register", "Registration"],
  ["lgu", "Barangay and city permits"],
  ["tax", "Tax returns"],
  ["employer", "Employer registration and contributions"],
  ["regulated", "Regulated activities"],
  ["close", "Closing a business"],
]

// The full forms catalog, ready to pre-fill and hand off.
export default function FormsPage(): ReactElement | null {
  const { profile, items, formMemory, formEdits } = useProfile()
  const [query, setQuery] = useState("")
  if (!profile) return null

  const mine = new Set(buildChecklist(profile, items).map((item) => item.id))
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matchingForms = FORMS.filter((form) =>
    words.every((word) => `${form.code} ${form.name} ${form.agency} ${form.purpose}`.toLowerCase().includes(word))
  )
  const rank = (form: FormTemplate): number =>
    (fitsProfile(form, profile) ? 1 : 0) + (form.requirementIds.some((id) => mine.has(id)) ? 1 : 0)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Forms</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Find the forms for your next step. Review answers from your business details, then file with the issuing agency.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              className="h-11 rounded-xl bg-background pl-10"
              placeholder="Search by form, number, or agency"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search forms"
            />
          </div>
          <p role="status" className="text-sm text-muted-foreground tabular-nums">
            {matchingForms.length} {matchingForms.length === 1 ? "form" : "forms"}{query.trim() ? ` found of ${FORMS.length}` : " in the library"}
          </p>
        </div>
      </header>
      {matchingForms.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">No forms found</h2>
          <p className="text-sm text-muted-foreground">Try an agency name such as DTI, or a form number such as 1901.</p>
          <Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>
        </div>
      )}
      {GROUPS.map(([group, title]) => {
        const forms = matchingForms.filter((form) => form.group === group).sort((a, b) => rank(b) - rank(a))
        if (!forms.length) return null
        return (
          <section key={group} aria-labelledby={`forms-${group}`} className="flex flex-col gap-4">
            <h2 id={`forms-${group}`} className="text-lg font-semibold tracking-tight">{title}</h2>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((form) => {
                const fields = fillForm(form, profile, formMemory, formEdits[form.id])
                const filled = fields.filter((field) => !field.missing).length
                const forYou = fitsProfile(form, profile) && form.requirementIds.some((id) => mine.has(id))
                return (
                  <li key={form.id} className="min-w-0">
                    <Card className="workspace-form-card h-full gap-0 rounded-[20px] py-0">
                      <div aria-hidden="true" className="workspace-form-art flex h-44 shrink-0 justify-center overflow-hidden px-8 pt-6">
                        <div className="flex w-44 flex-col gap-4 rounded-t-lg bg-white px-5 pt-5 shadow-sm">
                          <AgencyMark agency={form.agency} decorative className="h-12 w-24 justify-start p-0" />
                          <div className="flex flex-col gap-1.5">
                            <span className="h-1.5 w-full rounded-full bg-slate-200" />
                            <span className="h-1.5 w-5/6 rounded-full bg-slate-200" />
                            <span className="h-1.5 w-5/6 rounded-full bg-slate-200" />
                            <span className="h-1.5 w-3/5 rounded-full bg-slate-200" />
                          </div>
                        </div>
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-3 p-5">
                        <div className="flex items-center gap-2.5">
                          <AgencyMark agency={form.agency} decorative className="h-9 w-12" />
                          <p className="text-xs font-medium text-muted-foreground">{form.agency}</p>
                        </div>
                        <h3 className="text-base leading-snug font-semibold">{form.name}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{form.purpose}</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-1 text-xs">
                          {forYou && <span className="rounded-md bg-accent px-2 py-1 font-medium text-accent-foreground">For your business</span>}
                          {hasLibraryCopy(form.id, profile) && <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Official copy available</span>}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {HANDOFF_LABEL[form.handoff].split(" · ")[1]} · <span className="tabular-nums">{filled}/{fields.length}</span> fields filled
                        </p>
                      </CardContent>
                      <CardFooter className="px-5 pb-5">
                        <Link href={`/forms/${form.id}`} aria-label={`Open ${form.name}`} className={buttonVariants({ className: "workspace-form-cta" })}>
                          Open form<ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                      </CardFooter>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
