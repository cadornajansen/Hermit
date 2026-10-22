"use client"

import Link from "next/link"
import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { useFormConsent } from "@/components/form-consent"
import { fillForm, getForm, HANDOFF_LABEL } from "@/lib/forms"
import { libraryFiles } from "@/lib/library"
import { setFormAnswer, update, useProfile } from "@/lib/store"

// Side-by-side review before hand-off. HERMIT never submits: the owner files
// online, prints, or brings it to the office themselves.
export function FormSheet({ id }: { id: string }) {
  const { profile, formMemory, formEdits } = useProfile()
  const [copied, setCopied] = useState(false)
  const form = getForm(id)!
  const fields = profile
    ? fillForm(form, profile, formMemory, formEdits[id])
    : []
  const { choice, remember } = useFormConsent(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
    id
  )
  if (!profile) return null

  const missing = fields.filter((f) => f.missing).length
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
            ? `${missing} field ang kulang — punan sa baba. Saving for future forms is optional.`
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
                    {c.kind === "guide" ? "Gabay · Guide" : "Blank form"} ·{" "}
                    {(c.bytes / 1024).toFixed(0)} KB · kinopya{" "}
                    {c.retrievedAt.slice(0, 10)} ·{" "}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-primary">
                      official source
                    </a>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col gap-1">
                  {c.kind === "form" && c.path.endsWith(".pdf") && (
                    <Link href={`/forms/${form.id}/fill?file=${encodeURIComponent(c.path)}`} className={buttonVariants({ size: "sm" })}>
                      Punan
                    </Link>
                  )}
                  <a href={c.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Blank
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Kopya mula sa website ng ahensya. Pindutin ang &quot;Punan&quot; para ilagay ni Hermit ang mga sagot mo sa mismong
            form — puwede mong i-edit, ilipat at pirmahan bago i-download.
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
                <input
                  className="h-9 w-full rounded-lg border bg-background px-2 print:border-0"
                  value={f.value}
                  onChange={(e) => setFormAnswer(id, f.key, e.target.value)}
                  aria-label={f.label}
                />
                {f.source && (
                  <span className="text-[11px] text-muted-foreground">
                    From {f.source}. Editable for this form.
                  </span>
                )}
                {f.conflict && (
                  <div className="mt-1 text-xs">
                    <p>
                      Account and saved answer differ. Account: {f.account}.
                      Saved: {f.saved}.
                    </p>
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setFormAnswer(id, f.key, f.saved)}
                    >
                      Use saved answer
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {choice}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          variant="outline"
          onClick={() => {
            if (
              !confirm(
                "Clear this session's answers and PDF edits for this form? Saved reusable information stays in Profile."
              )
            )
              return
            update((s) => ({
              formEdits: { ...s.formEdits, [id]: {} },
              pdfDrafts: Object.fromEntries(
                Object.entries(s.pdfDrafts).filter(
                  ([key]) => !key.includes(`:${id}/`)
                )
              ),
            }))
          }}
        >
          Start a fresh form
        </Button>
        {portalIsUrl && (
          <a
            href={form.portal}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants()}
            onClick={() => void remember()}
          >
            {form.handoff === "portal" ? "Buksan ang portal at i-file" : `Open ${form.agency}`}
          </a>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(fields.map((f) => `${f.label}: ${f.value}`).join("\n"))
            setCopied(true)
            await remember()
          }}
        >
          {copied ? "Nakopya ✓" : "Copy field sheet"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.print()
            void remember()
          }}
        >
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
