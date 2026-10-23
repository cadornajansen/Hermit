"use client"

import { Download, FileText, Loader2, PenLine } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { buildFilledForm, formPlan, type FormContext, type PacketPlan } from "@/lib/pack"
import { useProfile } from "@/lib/store"

// A filled form as a file in the chat: thumbnail of its first page, name, and
// one tap to download. Built on the device from the owner's details.
export function FormFile({ formId, plan }: { formId?: string; plan?: PacketPlan["forms"][number] }) {
  const { profile, formMemory, formEdits, ownerId, pdfDrafts } = useProfile()
  const context: FormContext = { memory: formMemory, edits: formEdits, ownerId, drafts: pdfDrafts }
  const f = plan ?? (profile && formId ? formPlan(formId, profile, context) : null)
  const [file, setFile] = useState<{ bytes: Uint8Array; official: boolean } | null>(null)
  const [error, setError] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const key = f ? `${f.form.id}:${JSON.stringify(profile)}:${JSON.stringify(formEdits?.[f.form.id] ?? {})}` : ""

  useEffect(() => {
    if (!f || !profile) return
    let cancelled = false
    buildFilledForm(f, profile, context)
      .then(async (built) => {
        if (cancelled) return
        setFile(built)
        // First-page thumbnail.
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
        const doc = await pdfjs.getDocument({ data: built.bytes.slice() }).promise
        const page = await doc.getPage(1)
        const c = canvas.current
        if (!c || cancelled) return
        const viewport = page.getViewport({ scale: 1 })
        const v = page.getViewport({ scale: (c.width = 120 * 2) / viewport.width })
        c.height = v.height
        await page.render({ canvas: c, viewport: v }).promise
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
    // Rebuild when the owner's details or this form's answers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!f || !profile) return null
  const en = profile.lang === "en"
  const name = `${f.form.short.replace(/[^\w ]+/g, "").trim()} - filled.pdf`

  function download() {
    if (!file) return
    const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], { type: "application/pdf" }))
    Object.assign(document.createElement("a"), { href: url, download: name }).click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="flex gap-3 rounded-xl border bg-background p-3 text-xs">
      <div className="relative flex h-[156px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white shadow-sm">
        <canvas ref={canvas} className="h-auto w-full" aria-hidden />
        {!file && !error && <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />}
        {error && <FileText className="absolute size-8 text-muted-foreground" />}
        <span className="absolute right-1 bottom-1 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground">PDF</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground">
          {file?.official === false || !f.layout
            ? en
              ? "Answer sheet (no official copy mapped yet)"
              : "Answer sheet (wala pang mapped na opisyal na kopya)"
            : en
              ? `Official ${f.form.agency} form, filled with your details`
              : `Opisyal na form ng ${f.form.agency}, napunan na`}
        </p>
        {f.missing.length > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            {en ? "Still blank" : "Blanko pa"}: {f.missing.slice(0, 4).join(", ")}
            {f.missing.length > 4 ? ` +${f.missing.length - 4}` : ""}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={download} disabled={!file}>
            <Download /> {en ? "Download" : "I-download"}
          </Button>
          {f.file && f.layout ? (
            <Link href={`/forms/${f.form.id}/fill?file=${encodeURIComponent(f.file.path)}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              <PenLine /> {en ? "Review & sign" : "I-review at pirmahan"}
            </Link>
          ) : (
            <Link href={`/forms/${f.form.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              {en ? "Edit answers" : "I-edit ang sagot"}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
