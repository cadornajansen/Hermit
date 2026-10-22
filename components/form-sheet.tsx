"use client"

import Link from "next/link"
import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { fillForm, getForm, HANDOFF_LABEL } from "@/lib/forms"
import { libraryFiles } from "@/lib/library"
import { update, useProfile } from "@/lib/store"

// Side-by-side review before hand-off. HERMIT never submits: the owner files
// online, prints, or brings it to the office themselves.
export function FormSheet({ id }: { id: string }) {
  const { profile } = useProfile()
  const [copied, setCopied] = useState(false)
  const form = getForm(id)!
  if (!profile) return null

  const fields = fillForm(form, profile)
  const missing = fields.filter((f) => f.missing).length
  const remember = (key: string, value: string) =>
    update((s) => ({ profile: s.profile && { ...s.profile, extra: { ...s.profile.extra, [key]: value } } }))
  const portalIsUrl = form.portal.startsWith("http")
  const copies = libraryFiles(form.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/forms" className="text-sm text-primary print:hidden">
          ← Lahat ng forms
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{form.name}</h1>
        <p className="text-sm text-muted-foreground">{form.purpose}</p>
        <p className="text-xs text-muted-foreground print:hidden">
          {form.agency} · {HANDOFF_LABEL[form.handoff]}
          {!portalIsUrl && ` · ${form.portal}`}
        </p>
        <p className="text-sm print:hidden">
          {missing
            ? `${missing} field ang kulang — punan sa baba (o sabihin kay Kuya Hermit). Tatandaan ito para sa susunod na form.`
            : "Kumpleto na! I-review bago i-file."}
        </p>
      </div>
      {copies.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border p-3 print:hidden">
          <h2 className="text-sm font-semibold">Opisyal na form · Official blank form</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {copies.map((c) => (
              <li key={c.path} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.kind === "guide" ? "Gabay · Guide" : "Blank form"} · {(c.bytes / 1024).toFixed(0)} KB · kinopya{" "}
                    {c.retrievedAt.slice(0, 10)} ·{" "}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-primary">
                      official source
                    </a>
                  </span>
                </span>
                <a href={c.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  I-download
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Kopya mula sa website ng ahensya. Gamitin ang field sheet sa baba para kopyahin ang sagot mo sa form.
          </p>
        </section>
      )}
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {fields.map((f) => (
            <tr key={f.key}>
              <th scope="row" className="w-2/5 py-2 pr-3 text-left align-top font-normal text-muted-foreground">
                {f.label}
                {f.hint && <span className="block text-[11px]">{f.hint}</span>}
              </th>
              <td className="py-2">
                {f.fromProfile ? (
                  <span>{f.value}</span>
                ) : (
                  <input
                    className="h-9 w-full rounded-lg border bg-background px-2 print:border-0"
                    defaultValue={f.value}
                    onBlur={(e) => e.target.value.trim() !== f.value && remember(f.key, e.target.value.trim())}
                    aria-label={f.label}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 print:hidden">
        {portalIsUrl && (
          <a href={form.portal} target="_blank" rel="noreferrer" className={buttonVariants()}>
            {form.handoff === "portal" ? "Buksan ang portal at i-file" : `Open ${form.agency}`}
          </a>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(fields.map((f) => `${f.label}: ${f.value}`).join("\n"))
            setCopied(true)
          }}
        >
          {copied ? "Nakopya ✓" : "Copy field sheet"}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
        {form.source !== form.portal && (
          <a href={form.source} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost" })}>
            Official form page
          </a>
        )}
        <Link href={`/assistant?q=${encodeURIComponent(`Tulungan mo akong punan ang ${form.name}`)}`} className={buttonVariants({ variant: "ghost" })}>
          Ipa-fill kay Kuya Hermit
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Field sheet — kopyahin sa official form o portal. Compare with the official form before filing. Hindi ito legal o tax advice.
      </p>
    </div>
  )
}
