"use client"

import { Download, Eraser, GripVertical, Minus, PenLine, Plus, RotateCcw, Type, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useFormConsent } from "@/components/form-consent"
import {
  answersFromBoxes,
  boxId,
  draftKey as stateKey,
  initialBoxes,
  type Box,
  type Layout,
} from "@/lib/fill"
import layouts from "@/lib/form-layouts.json"
import { fillForm, getForm } from "@/lib/forms"
import { libraryFiles } from "@/lib/library"
import { update, useProfile } from "@/lib/store"
import { cn } from "@/lib/utils"

// Fills the official PDF itself. HERMIT places the owner's answers; the owner
// reviews, edits, drags, adds text and signs, then downloads. Everything runs
// on the device: the signature and the filled PDF never leave it.

type Mode =
  | { kind: "none" }
  | { kind: "text"; text: string; key?: string }
  | { kind: "signature"; image: string; aspect: number }

export function PdfEditor({ formId, filePath }: { formId: string; filePath?: string }) {
  const { profile, ownerId, formMemory, formEdits, pdfDrafts } = useProfile()
  const form = getForm(formId)!
  const pdfs = libraryFiles(formId, profile).filter((f) => f.kind === "form" && f.path.endsWith(".pdf"))
  const file = pdfs.find((f) => f.path === filePath) ?? pdfs[0]
  const layout = file ? ((layouts as Record<string, Layout>)[file.path] ?? null) : null

  const [bytes, setBytes] = useState<ArrayBuffer>()
  const [pages, setPages] = useState<{ w: number; h: number }[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>()
  const [mode, setMode] = useState<Mode>({ kind: "none" })
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const [width, setWidth] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)

  const fields = profile
    ? fillForm(form, profile, formMemory, formEdits[formId])
    : []
  const values = Object.fromEntries(fields.map((f) => [f.key, f.value]))
  const draftId = file && ownerId ? stateKey(ownerId, file.path, layout) : null
  const { choice, remember } = useFormConsent(answersFromBoxes(boxes), file?.path ?? formId)

  // Load the PDF and the owner's saved edits (or HERMIT's first fill).
  useEffect(() => {
    if (!file || !profile || !ownerId) return
    let cancelled = false
    fetch(file.url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => {
        if (cancelled) return
        setBytes(buf)
        const saved = pdfDrafts[stateKey(ownerId, file.path, layout)]
        setBoxes(saved ?? (layout ? initialBoxes(layout, values).boxes : []))
        setLoadedKey(stateKey(ownerId, file.path, layout))
        setPages([])
        setMode({ kind: "none" })
        setSigning(false)
        setSelected(undefined)
        setError(undefined)
      })
      .catch((e) => { if (!cancelled) setError(`Hindi ma-load ang form (${e.message}).`) })
    return () => {
      cancelled = true
    }
    // values/layout derive from props+profile; load once per file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path, ownerId, !!profile])

  // Session draft only: no automatic retention of answers or signatures on disk.
  useEffect(() => {
    if (!file || !bytes || !ownerId) return
    const key = stateKey(ownerId, file.path, layout)
    if (key !== loadedKey) return
    update((s) =>
      s.ownerId !== ownerId || s.pdfDrafts[key] === boxes
        ? {}
        : { pdfDrafts: { ...s.pdfDrafts, [key]: boxes } }
    )
  }, [boxes, bytes, file, layout, ownerId, loadedKey])

  // The page container only exists once the profile has loaded.
  const ready = Boolean(profile && file && loadedKey === draftId)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  // Render pages with pdf.js.
  useEffect(() => {
    if (!bytes || !width || !ready) return
    let cancelled = false
    ;(async () => {
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
      const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
      const sizes: { w: number; h: number }[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const [, , w, h] = page.view
        sizes.push({ w, h })
      }
      if (cancelled) return
      setPages(sizes)
      await new Promise((r) => requestAnimationFrame(r))
      for (let i = 1; i <= doc.numPages; i++) {
        const canvas = canvases.current[i - 1]
        if (!canvas || cancelled) continue
        const page = await doc.getPage(i)
        const ratio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: (width / sizes[i - 1].w) * ratio })
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
      }
    })().catch((e) => setError(`Hindi ma-display ang form (${e.message}).`))
    return () => {
      cancelled = true
    }
  }, [bytes, width, ready])

  const patch = (id: string, p: Partial<Box>) => setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)))

  function placeAt(page: number, e: React.PointerEvent<HTMLDivElement>) {
    if (mode.kind === "none") {
      setSelected(undefined)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const s = rect.width / pages[page].w
    const x = (e.clientX - rect.left) / s
    const y = pages[page].h - (e.clientY - rect.top) / s
    const box: Box =
      mode.kind === "signature"
        ? { id: boxId(), page, x, y: y - 30 * mode.aspect, size: 120, kind: "signature", text: "", image: mode.image, aspect: mode.aspect }
        : {
            id: boxId(),
            page,
            x,
            y: y - 3,
            size: 9,
            kind: "text",
            text: mode.text,
            key: mode.key,
            reusable: !!mode.key,
          }
    setBoxes((bs) => [...bs, box])
    setSelected(box.id)
    setMode({ kind: "none" })
  }

  async function download() {
    if (!bytes || !ready) return
    setBusy(true)
    setError(undefined)
    try {
      const [{ PDFDocument, StandardFonts }, { drawBoxes }] = await Promise.all([import("pdf-lib"), import("@/lib/pdf-draw")])
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const acro = await drawBoxes(pdf, boxes, font)
      if (acro) acro.updateFieldAppearances(font)
      const out = await pdf.save()
      const url = URL.createObjectURL(new Blob([out.slice().buffer], { type: "application/pdf" }))
      Object.assign(document.createElement("a"), { href: url, download: `${form.short.replace(/\s+/g, "-")}-HERMIT.pdf` }).click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await remember()
    } catch (e) {
      setError(`Hindi ma-export ang PDF (${e instanceof Error ? e.message : "error"}). I-print ang blank form at punan nang manual.`)
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null
  if (!file)
    return (
      <p className="text-sm">
        Walang naka-store na PDF para sa form na ito.{" "}
        <Link href={`/forms/${formId}`} className="text-primary">
          Bumalik</Link>
      </p>
    )

  if (!ready) return <p role="status" className="text-sm">{error || "Loading this account's form…"} <Link href={`/forms/${formId}`} className="text-primary underline">Back to field sheet</Link></p>

  const sel = boxes.find((b) => b.id === selected)
  const palette = fields.filter((f) => f.value)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 print:hidden">
        <Link href={`/forms/${formId}`} className="text-sm text-primary">
          ← {form.short}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Punan ang {file.label}</h1>
        <p className="text-sm text-muted-foreground">
          Napunan na ni Hermit ang form gamit ang profile mo. I-check, pindutin ang &quot;Pirma&quot; para pumirma (kusa itong
          ilalagay sa linya ng pirma), at i-download. Kung may mali, pindutin ang sagot para i-edit.
        </p>
        {pdfs.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {pdfs.map((p) => (
              <Link
                key={p.path}
                href={`/forms/${formId}/fill?file=${encodeURIComponent(p.path)}`}
                className={cn("rounded-full border px-3 py-1 text-xs", p.path === file.path && "border-primary bg-primary/10")}
              >
                {p.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {fields.some((f) => f.conflict) && (
        <p className="text-sm">
          Account details and saved answers differ.{" "}
          <Link className="text-primary underline" href={`/forms/${formId}`}>
            Review both on the field sheet
          </Link>{" "}
          before downloading. Current PDF edits stay in place; Reset explicitly
          re-fills from the latest details.
        </p>
      )}
      {choice}
      <p className="text-xs text-muted-foreground">PDF edits and signatures last for this session only. A session draft keeps its edits; Reset explicitly re-fills from the latest field sheet.</p>

      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 py-2 backdrop-blur">
        <Button size="sm" variant={mode.kind === "text" && !mode.text ? "default" : "outline"} onClick={() => setMode({ kind: "text", text: "" })}>
          <Type /> Text
        </Button>
        <Button size="sm" variant={mode.kind === "signature" ? "default" : "outline"} onClick={() => setSigning(true)}>
          <PenLine /> Pirmahan
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!confirm("Ibalik sa unang fill ni Hermit? Mawawala ang mga edit mo sa form na ito.")) return
            setBoxes(layout ? initialBoxes(layout, values).boxes : [])
          }}
        >
          <RotateCcw /> Reset
        </Button>
        <Button size="sm" className="ml-auto" onClick={download} disabled={busy || !bytes}>
          <Download /> {busy ? "Ginagawa…" : "I-download"}
        </Button>
      </div>

      {mode.kind !== "none" && (
        <p className="rounded-xl bg-primary/10 p-2 text-sm">
          Pindutin ang lugar sa form kung saan ilalagay ang{" "}
          {mode.kind === "signature" ? "pirma" : mode.text ? `"${mode.text}"` : "bagong text"}
          .{" "}
          <button className="text-primary underline" onClick={() => setMode({ kind: "none" })}>
            Kanselahin
          </button>
        </p>
      )}

      <details className="text-sm print:hidden">
        <summary className="cursor-pointer text-primary">Mga sagot mo · tap to place one anywhere</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {palette.map((f) => (
            <button
              key={f.key}
              className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
              title={f.label}
              onClick={() =>
                setMode({ kind: "text", text: f.value, key: f.key })
              }
            >
              {f.label}:{" "}
              {f.value.length > 24 ? `${f.value.slice(0, 24)}…` : f.value}
            </button>
          ))}
        </div>
      </details>

      {sel && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2 text-sm">
          {sel.kind === "text" && (
            <input
              autoFocus
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2"
              value={sel.text}
              onChange={(e) => patch(sel.id, { text: e.target.value })}
              aria-label="Edit text"
            />
          )}
          <Button size="icon-sm" variant="outline" aria-label="Smaller" onClick={() => patch(sel.id, { size: Math.max(5, sel.size - (sel.kind === "signature" ? 10 : 1)) })}>
            <Minus />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Bigger" onClick={() => patch(sel.id, { size: sel.size + (sel.kind === "signature" ? 10 : 1) })}>
            <Plus />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setBoxes((bs) => bs.filter((b) => b.id !== sel.id))
              setSelected(undefined)
            }}
          >
            <Eraser /> Alisin
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div ref={wrap} className="flex flex-col gap-4">
        {pages.map((pg, i) => {
          const s = width / pg.w
          return (
            <div
              key={i}
              className={cn("relative overflow-hidden rounded-md border bg-white shadow-sm", mode.kind !== "none" && "cursor-crosshair")}
              style={{ width, height: pg.h * s }}
              onPointerDown={(e) => placeAt(i, e)}
            >
              <canvas
                ref={(el) => {
                  canvases.current[i] = el
                }}
                className="absolute inset-0 h-full w-full"
              />
              {boxes
                .filter((b) => b.page === i)
                .map((b) => (
                  <BoxView key={b.id} box={b} scale={s} pageH={pg.h} selected={b.id === selected} onSelect={() => setSelected(b.id)} onMove={(x, y) => patch(b.id, { x, y, pdfField: undefined /* moved by the owner: draw it where they put it */ })} />
                ))}
            </div>
          )
        })}
        {!pages.length && !error && <p className="text-sm text-muted-foreground">Nilo-load ang form…</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        I-check ang bawat sagot bago i-file — puwedeng magkamali ng puwesto si Hermit. Ang pirma at ang na-fill na PDF ay nasa
        device mo lang. Hindi ito legal o tax advice.
      </p>

      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onDone={(image, aspect) => {
            setSigning(false)
            const slot = layout ? initialBoxes(layout, values).signature : undefined
            if (slot) {
              const box: Box = { id: boxId(), page: slot.page, x: slot.x, y: slot.y, size: slot.width, kind: "signature", text: "", image, aspect }
              setBoxes((bs) => [...bs.filter((b) => b.kind !== "signature"), box])
              setSelected(box.id)
            } else setMode({ kind: "signature", image, aspect })
          }}
        />
      )}
    </div>
  )
}

function BoxView({
  box: b,
  scale: s,
  pageH,
  selected,
  onSelect,
  onMove,
}: {
  box: Box
  scale: number
  pageH: number
  selected: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
}) {
  const h = b.kind === "signature" ? b.size * (b.aspect ?? 0.4) : b.size
  const left = b.x * s
  const top = (pageH - b.y - h) * s

  function drag(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const start = { cx: e.clientX, cy: e.clientY, x: b.x, y: b.y }
    const move = (ev: PointerEvent) => onMove(start.x + (ev.clientX - start.cx) / s, start.y - (ev.clientY - start.cy) / s)
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div
      className={cn("absolute flex touch-none items-end select-none", selected && "z-10")}
      style={{ left: left - 12, top }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <span
        onPointerDown={drag}
        className={cn("flex h-4 w-3 cursor-grab items-center text-blue-600 opacity-60", selected && "opacity-100")}
        aria-label="Drag"
      >
        <GripVertical className="size-3" />
      </span>
      {b.kind === "signature" && b.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.image} alt="Pirma" style={{ width: b.size * s }} className={cn("pointer-events-none", selected && "outline outline-blue-500")} />
      ) : (
        <span
          className={cn(
            "rounded-sm px-px leading-none whitespace-pre text-blue-900",
            selected ? "bg-blue-200/70 outline outline-blue-500" : "bg-blue-100/50"
          )}
          style={{ fontSize: b.size * s, fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          {b.pitch
            ? [...b.text].map((ch, i) => (
                <span key={i} className="inline-block text-center" style={{ width: b.pitch! * s }}>
                  {ch}
                </span>
              ))
            : b.text || " "}
        </span>
      )}
    </div>
  )
}

function SignaturePad({ onDone, onCancel }: { onDone: (png: string, aspect: number) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = ref.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.clientWidth * ratio
    c.height = c.clientHeight * ratio
    const ctx = c.getContext("2d")!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#0b1f5c"
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  function finish() {
    const c = ref.current!
    // Crop to the ink so the signature places cleanly.
    const ctx = c.getContext("2d")!
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
    let [x0, y0, x1, y1] = [width, height, 0, 0]
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
    if (x1 <= x0 || y1 <= y0) return
    const pad = 4
    const out = document.createElement("canvas")
    out.width = x1 - x0 + pad * 2
    out.height = y1 - y0 + pad * 2
    out.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height)
    onDone(out.toDataURL("image/png"), out.height / out.width)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-label="Signature">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-background p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Iguhit ang pirma mo</h2>
          <Button size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Close">
            <X />
          </Button>
        </div>
        <canvas
          ref={ref}
          className="h-40 w-full touch-none rounded-xl border bg-white"
          onPointerDown={(e) => {
            drawing.current = true
            const ctx = e.currentTarget.getContext("2d")!
            ctx.beginPath()
            ctx.moveTo(...point(e))
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = e.currentTarget.getContext("2d")!
            ctx.lineTo(...point(e))
            ctx.stroke()
            setEmpty(false)
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />
        <p className="text-xs text-muted-foreground">
          Nasa device mo lang ang pirma. Hindi ito ina-upload.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const c = ref.current!
              c.getContext("2d")!.clearRect(0, 0, c.width, c.height)
              setEmpty(true)
            }}
          >
            Burahin
          </Button>
          <Button className="flex-1" disabled={empty} onClick={finish}>
            Gamitin ang pirma
          </Button>
        </div>
      </div>
    </div>
  )
}
