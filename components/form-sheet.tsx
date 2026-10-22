"use client"

import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { fillForm, getForm } from "@/lib/forms"
import { update, useProfile } from "@/lib/store"

// Side-by-side review before export. HERMIT never submits: the owner prints,
// uploads or copy-pastes into the agency portal themselves.
export function FormSheet({ id }: { id: string }) {
  const { profile } = useProfile()
  const [copied, setCopied] = useState(false)
  const form = getForm(id)!
  if (!profile) return null

  const fields = fillForm(form, profile)
  const missing = fields.filter((f) => f.missing).length
  const remember = (key: string, value: string) =>
    update((s) => ({ profile: s.profile && { ...s.profile, extra: { ...s.profile.extra, [key]: value } } }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{form.name}</h1>
        <p className="text-sm text-muted-foreground print:hidden">
          {missing ? `${missing} field ang kulang — punan sa baba, tatandaan ito ni Hermit para sa susunod na form.` : "Kumpleto na! I-review bago i-print o i-upload."}
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {fields.map((f) => (
            <tr key={f.key}>
              <th scope="row" className="w-2/5 py-2 pr-3 text-left align-top font-normal text-muted-foreground">
                {f.label}
              </th>
              <td className="py-2">
                {f.source && !f.missing ? (
                  <span>{f.value}</span>
                ) : (
                  <input
                    className="h-9 w-full rounded-lg border bg-background px-2 print:border-0"
                    defaultValue={f.value}
                    onBlur={(e) => remember(f.key, e.target.value.trim())}
                    aria-label={f.label}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(fields.map((f) => `${f.label}: ${f.value}`).join("\n"))
            setCopied(true)
          }}
        >
          {copied ? "Nakopya ✓" : "Copy field sheet"}
        </Button>
        <a href={form.portal} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
          Open {form.agency} portal
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Draft field sheet — compare with the official form before filing. Hindi ito legal o tax advice.
      </p>
    </div>
  )
}
