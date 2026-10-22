// Works out WHERE each answer goes on every stored official PDF, once per
// file version, and writes lib/form-layouts.json for the in-app form editor.
//
//   pnpm forms:layout            (after pnpm forms:sync; needs ASSEMBLYAI_API_KEY)
//
// Kuya Hermit only matches HERMIT's field keys to text printed on the form
// (by item number); the coordinates are computed here from the PDF itself.
// Fillable PDFs (AcroForm) are matched by their real field names instead.
// The owner reviews and drags every box in the editor before downloading.
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib"
import { getDocumentProxy } from "unpdf"

import { FIELDS, FORMS } from "../lib/forms.ts"

const MANIFEST = JSON.parse(readFileSync(new URL("../lib/form-files.json", import.meta.url), "utf8"))
const OUT = new URL("../lib/form-layouts.json", import.meta.url)
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/forms/`
const MODEL = process.env.HERMIT_MODEL || "claude-opus-5-5"
if (!process.env.ASSEMBLYAI_API_KEY) throw new Error("ASSEMBLYAI_API_KEY is required (pnpm forms:layout reads .env.local)")

// Choice fields: the value HERMIT holds → mark the matching option on the form.
const CHOICES = {
  structure: ["Sole proprietorship", "Partnership", "Corporation / OPC", "Cooperative"],
  premises: ["Home-based", "Rented", "Owned"],
  tax_option: ["8% flat rate", "Graduated rates"],
}

async function llm(prompt, schema) {
  const res = await fetch("https://llm-gateway.assemblyai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "layout", schema, strict: true } },
      post_processing_steps: [{ type: "json-repair" }],
    }),
    signal: AbortSignal.timeout(240_000),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`LLM ${res.status}: ${json.message}`)
  const content = json.choices.map((c) => c.message.content ?? "").join("")
  return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1))
}

const fieldList = (form) =>
  form.fields
    .map((k) => `- ${k}: ${FIELDS[k].label}${CHOICES[k] ? ` (choice; options: ${CHOICES[k].map((o) => `"${o}"`).join(", ")})` : ""}`)
    .join("\n")

async function textItems(bytes) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const items = []
  const pages = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const [, , w, h] = page.view
    pages.push({ w, h })
    const { items: raw } = await page.getTextContent()
    for (const it of raw) {
      const text = it.str?.trim()
      if (!text) continue
      items.push({ page: p - 1, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) || 8, text })
    }
  }
  return { items, pages }
}

const ENTRY = {
  type: "object",
  properties: {
    key: { type: "string" },
    target: { type: "string", description: "item number (flat PDF) or field name (fillable PDF)" },
    where: { type: "string", enum: ["below", "right", "left", "in"] },
    equals: { type: "string", description: "for choice fields: the option this target marks; otherwise empty" },
  },
  required: ["key", "target", "where", "equals"],
  additionalProperties: false,
}
const SCHEMA = { type: "object", properties: { entries: { type: "array", items: ENTRY } }, required: ["entries"], additionalProperties: false }

async function layoutFlat(form, bytes) {
  const { items, pages } = await textItems(bytes)
  const listing = items.map((it, i) => `${i}|p${it.page + 1}|${Math.round(it.x)},${Math.round(it.y)}|${it.text.slice(0, 80)}`).join("\n")
  const { entries } = await llm(
    `This is the text layer of the official Philippine form "${form.name}" (items: number|page|x,y in PDF points from bottom-left|text). Match HERMIT's fields to where the owner writes each answer.

For each field below that this form actually asks for, give the item number of the printed label CLOSEST to the blank where the answer is written — prefer the small sub-label directly above the box (e.g. "(Last Name)", "Unit/Room/Floor/Building No.", "Barangay") over the numbered section heading — and where the answer goes relative to it: "below" (box under that label, the usual layout on BIR forms) or "right" (blank to the right on the same line). For choice fields, give one entry per option you can find, targeting that option's printed text with where="left" (a box/checkmark sits left of it) and equals = the HERMIT option it corresponds to. Skip fields the form doesn't ask for, sections "To be filled out by BIR", and signature lines. Use each label once. Don't guess: if unsure, skip.

HERMIT fields:
${fieldList(form)}

TEXT ITEMS:
${listing}`,
    SCHEMA
  )
  const out = []
  for (const e of entries) {
    const it = items[Number(e.target)]
    if (!it || !(e.key in FIELDS)) continue
    const size = Math.max(6, Math.min(9, it.h || 8))
    const onPage = items.filter((o) => o.page === it.page)
    let pos
    if (e.where === "right") {
      // Skip printed words that continue the label on the same line, e.g. "(TIN)".
      let end = it.x + it.w
      for (const o of onPage.filter((o) => Math.abs(o.y - it.y) < 3 && o.x >= end - 1).sort((a, b) => a.x - b.x))
        if (o.x - end < 12) end = o.x + o.w
      pos = { x: end + 4, y: it.y }
    } else if (e.where === "left") pos = { x: it.x - 9, y: it.y }
    else pos = { x: it.x, y: it.y - size - 5 }
    // Answers must not sit on printed text: nudge down until clear (≤ 16pt).
    if (e.where !== "left") {
      const clashes = (y) =>
        onPage.some((o) => o !== it && o.x < pos.x + 90 && o.x + o.w > pos.x && o.y < y + size && o.y + o.h > y - 1)
      let dy = 0
      while (dy < 16 && clashes(pos.y - dy)) dy += 2
      pos = { ...pos, y: pos.y - (clashes(pos.y - dy) ? 0 : dy) }
    }
    out.push({ key: e.key, page: it.page, ...pos, size, ...(e.equals ? { equals: e.equals, mark: true } : {}) })
  }
  return { pages, entries: out }
}

async function layoutAcro(form, pdf, bytes) {
  const { items, pages } = await textItems(bytes)
  const pageRefs = pdf.getPages().map((p) => p.ref)
  const fields = []
  for (const f of pdf.getForm().getFields()) {
    const type = f instanceof PDFCheckBox ? "checkbox" : f instanceof PDFTextField ? "text" : null
    if (!type) continue
    const widget = f.acroField.getWidgets()[0]
    if (!widget) continue
    const r = widget.getRectangle()
    const page = Math.max(0, pageRefs.findIndex((ref) => ref === widget.P()))
    const near = items
      .filter((it) => it.page === page && ((Math.abs(it.y - (r.y + r.height / 2)) < 7 && it.x < r.x + r.width + 120) || (it.y > r.y + r.height && it.y - (r.y + r.height) < 14 && Math.abs(it.x - r.x) < 160)))
      .sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))
      .slice(0, 4)
      .map((it) => it.text)
      .join(" / ")
    fields.push({ name: f.getName(), type, page, r, near })
  }
  const listing = fields.map((f) => `${f.name}|${f.type}|p${f.page + 1}|${Math.round(f.r.x)},${Math.round(f.r.y)}|near: ${f.near.slice(0, 120)}`).join("\n")
  const { entries } = await llm(
    `This is a fillable official Philippine form "${form.name}". Each line is a form field: name|type|page|x,y|nearby printed text. Map HERMIT's fields to form fields.

For text fields use where="in". For choice fields, map each matching checkbox with where="in" and equals = the HERMIT option it represents. Skip fields you can't identify confidently, and anything for official use only. Use each form field once.

HERMIT fields:
${fieldList(form)}

FORM FIELDS:
${listing}`,
    SCHEMA
  )
  const byName = new Map(fields.map((f) => [f.name, f]))
  const out = []
  for (const e of entries) {
    const f = byName.get(e.target)
    if (!f || !(e.key in FIELDS)) continue
    const size = Math.max(6, Math.min(9, f.r.height - 2))
    out.push({
      key: e.key,
      page: f.page,
      x: f.r.x + 2,
      y: f.r.y + Math.max(2, (f.r.height - size) / 2),
      size,
      pdfField: f.name,
      ...(f.type === "checkbox" ? { mark: true, equals: e.equals || "" } : {}),
    })
  }
  return { pages, entries: out }
}

const layouts = {}
for (const form of FORMS) {
  for (const file of MANIFEST[form.id] ?? []) {
    if (file.kind !== "form" || !file.path.endsWith(".pdf")) continue
    const old = previous[file.path]
    if (old && old.sha256 === file.sha256 && !process.argv.includes("--force")) {
      layouts[file.path] = old
      console.log(`= ${file.path} (unchanged)`)
      continue
    }
    try {
      const bytes = await (await fetch(BASE + file.path)).arrayBuffer()
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const fillable = pdf.getForm().getFields().length > 0
      const layout = fillable ? await layoutAcro(form, pdf, bytes) : await layoutFlat(form, bytes)
      layouts[file.path] = { formId: form.id, sha256: file.sha256, fillable, ...layout, generatedAt: new Date().toISOString(), model: MODEL }
      console.log(`✓ ${file.path}: ${layout.entries.length} placements${fillable ? " (fillable)" : ""}`)
    } catch (e) {
      console.log(`✗ ${file.path}: ${e.message}`)
      if (old) layouts[file.path] = old
    }
  }
}
writeFileSync(OUT, `${JSON.stringify(layouts, null, 1)}\n`)
