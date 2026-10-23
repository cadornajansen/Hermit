"use client"

import Link from "next/link"
import { useState } from "react"

import { buildChecklist } from "@/lib/engine"
import { fillForm, fitsProfile, FORMS, HANDOFF_LABEL, type FormTemplate } from "@/lib/forms"
import { hasLibraryCopy } from "@/lib/library"
import { useProfile } from "@/lib/store"

const GROUPS: [FormTemplate["group"], string][] = [
  ["register", "Pagrehistro · Registration"],
  ["lgu", "Barangay at city hall · LGU"],
  ["tax", "Buwis · Tax returns"],
  ["employer", "Employer"],
  ["regulated", "Regulated (FDA, Customs)"],
  ["close", "Pagsasara · Closing"],
]

// The full forms catalog, ready to pre-fill and hand off.
export default function FormsPage() {
  const { profile, items, formMemory, formEdits } = useProfile()
  const [q, setQ] = useState("")
  if (!profile) return null

  const mine = new Set(buildChecklist(profile, items).map((i) => i.id))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const match = (f: FormTemplate) => words.every((w) => `${f.code} ${f.name} ${f.agency} ${f.purpose}`.toLowerCase().includes(w))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mga form</h1>
        <p className="text-sm text-muted-foreground">
          {FORMS.length} forms mula sa BIR, DTI, SEC, LGU, SSS, PhilHealth, Pag-IBIG, DOLE at FDA. Naka-pre-fill na mula sa
          profile mo; ikaw ang magpa-file.
        </p>
      </div>
      <input
        className="h-11 rounded-xl border bg-background px-3 text-base"
        placeholder="Hanapin: 1901, barangay, SSS, quarterly…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search forms"
      />
      {GROUPS.map(([g, title]) => {
        const rank = (f: FormTemplate) => (fitsProfile(f, profile) ? 1 : 0) + (f.requirementIds.some((r) => mine.has(r)) ? 1 : 0)
        const list = FORMS.filter((f) => f.group === g && match(f)).sort((a, b) => rank(b) - rank(a))
        if (!list.length) return null
        return (
          <section key={g} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
            <ul className="flex flex-col divide-y rounded-2xl border">
              {list.map((f) => {
                const fields = fillForm(f, profile, formMemory, formEdits[f.id])
                const filled = fields.filter((x) => !x.missing).length
                const forYou = fitsProfile(f, profile) && f.requirementIds.some((r) => mine.has(r))
                return (
                  <li key={f.id}>
                    <Link href={`/forms/${f.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted">
                      <span className="min-w-0">
                        <span className="block font-medium">{f.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {f.agency} ·{" "}
                          {HANDOFF_LABEL[f.handoff].split(" · ")[1]}
                          {forYou && <span className="text-primary"> · para sa iyo</span>}
                          {hasLibraryCopy(f.id, profile) && <span> · may opisyal na kopya</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {filled}/{fields.length}
                      </span>
                    </Link>
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
