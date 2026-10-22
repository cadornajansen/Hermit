// Works out exactly where each answer goes on every stored official PDF,
// once per file version, and writes lib/form-layouts.json for the editor.
//
//   pnpm forms:layout            (after pnpm forms:sync; needs ASSEMBLYAI_API_KEY)
//   pnpm forms:layout --force    (redo every file)
//
// The model is text-only, so scripts/form-vision.mjs first "sees" each page:
// it finds every drawn box and reads every word (text layer or OCR). Kuya
// Hermit then picks the box (and sub-label, name part, format) for each
// answer; the coordinates are computed here. Fillable PDFs use their fields.
import { existsSync, readFileSync, writeFileSync } from "node:fs"

import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib"

import { FIELDS, FORMS } from "../lib/forms.ts"
import { analyzePdf, closeOcr, describe } from "./form-vision.mjs"

const MANIFEST = JSON.parse(readFileSync(new URL("../lib/form-files.json", import.meta.url), "utf8"))
const OUT = new URL("../lib/form-layouts.json", import.meta.url)
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/forms/`
const MODEL = process.env.HERMIT_MODEL || "claude-opus-5-5"
if (!process.env.ASSEMBLYAI_API_KEY) throw new Error("ASSEMBLYAI_API_KEY is required (pnpm forms:layout reads .env.local)")
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)

const CHOICES = {
  structure: ["Sole proprietorship", "Partnership", "Corporation / OPC", "Cooperative"],
  premises: ["Home-based", "Rented", "Owned"],
  tax_option: ["8% flat rate", "Graduated rates"],
}
// Answers HERMIT can give on any form, beyond the form's own field list.
const SPECIAL = {
  __today: "Today's date (for the DATE line next to the owner's signature)",
  __signature: "Where the owner signs (the signature box, or the line above the word SIGNATURE)",
  __constant: "A checkbox that is true for every HERMIT user, a business owner (e.g. Type of employer: Business). Marks only.",
}

async function llm(prompt, schema) {
  const res = await fetch("https://llm-gateway.assemblyai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: process.env.ASSEMBLYAI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "layout", schema, strict: true } },
      post_processing_steps: [{ type: "json-repair" }],
    }),
    signal: AbortSignal.timeout(300_000),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`LLM ${res.status}: ${json.message}`)
  const content = json.choices.map((c) => c.message.content ?? "").join("")
  return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1))
}

const keyList = (form) =>
  [
    ...[...new Set([...form.fields, "owner_name", "birth_date"])].map(
      (k) => `- ${k}: ${FIELDS[k].label}${CHOICES[k] ? ` (choice; options: ${CHOICES[k].map((o) => `"${o}"`).join(", ")})` : ""}`
    ),
    ...Object.entries(SPECIAL).map(([k, v]) => `- ${k}: ${v}`),
  ].join("\n")

const ENTRY = {
  type: "object",
  properties: {
    key: { type: "string" },
    target: { type: "string", description: "box id (flat PDF) or field name (fillable PDF)" },
    part: { type: "string", enum: ["full", "last", "first", "middle"] },
    format: { type: "string", enum: ["as_is", "upper", "date"] },
    anchor: { type: "string", description: "exact sub-label text inside the box to align under/over, or empty" },
    where: { type: "string", enum: ["fill", "below_anchor", "above_anchor", "mark"] },
    equals: { type: "string", description: "choice fields: the HERMIT option this checkbox means; else empty" },
  },
  required: ["key", "target", "part", "format", "anchor", "where", "equals"],
  additionalProperties: false,
}
const SCHEMA = { type: "object", properties: { entries: { type: "array", items: ENTRY } }, required: ["entries"], additionalProperties: false }
const KEYS_OK = (k) => k in FIELDS || k in SPECIAL
// Printed-label patterns for answers the model sometimes misplaces.
const VERIFY = {
  email: /e-?\s?mail/i,
  mobile: /mobile|cell|phone|tel|contact/i,
  tin: /\btin\b|tax\s*identification|taxpayer identification/i,
  birth_date: /birth/i,
  start_date: /start|commence|operation/i,
  dti_no: /\bdti\b|\bbn\b|\bbnn\b|\bsec\b|\bcda\b|registration|certificate/i,
}

const RULES = `Rules:
- Fill EVERY answer below that the form asks for. Use where="fill" to write in the box. When one box holds several sub-labels side by side (e.g. "(LAST NAME) (FIRST NAME) (MIDDLE NAME)" or "(BARANGAY) (CITY/MUNICIPALITY)"), add one entry per sub-label with anchor = that sub-label exactly as printed and where="below_anchor".
- Names: when the form separates last / first / middle name, use key owner_name with part="last" / "first" / "middle"; otherwise part="full".
- Dates: format="date". If the form says to print in CAPITAL LETTERS, use format="upper" for all text answers.
- Checkboxes: where="mark", target the small checkbox box beside the option's words; for choice fields set equals to the matching HERMIT option. Use __constant only for boxes true for every business owner.
- Signature: one __signature entry for the owner's / taxpayer's / employer's signature (if the box contains the word SIGNATURE, anchor="SIGNATURE", where="above_anchor"); add __today on the DATE line beside it (anchor="DATE", where="above_anchor" when the word is in the box).
- Never fill sections for official / agency use ("To be filled out by BIR/SSS", "For SSS use", "Part II"), a household-employer section when a business-employer section exists, or spouse / representative / authorized-agent sections.
- Skip anything you are not sure about.`

function findWord(words, anchor) {
  const want = anchor.replace(/[()]/g, "").trim().toLowerCase()
  if (!want) return undefined
  const first = want.split(/\s+/)[0]
  return words.find((w) => w.text.toLowerCase().replace(/[()]/g, "").includes(want)) ?? words.find((w) => w.text.toLowerCase().replace(/[()]/g, "").includes(first))
}

async function layoutFlat(form, bytes) {
  const pages = await analyzePdf(bytes)
  const boxes = new Map()
  const lines = []
  pages.forEach((pg, i) => {
    lines.push(`--- page ${i + 1}${pg.scanned ? " (scanned; words via OCR, may have typos)" : ""}`)
    for (const b of pg.boxes) {
      const d = describe(b, pg.words)
      boxes.set(b.id, { ...b, words: pg.words })
      lines.push(
        `${b.id} [x${Math.round(b.x)} y${Math.round(b.y)} w${Math.round(b.w)} h${Math.round(b.h)}]${b.slots ? ` slots=${b.slots}` : ""}${b.w < 14 && b.h < 14 ? " checkbox" : ""} inside:"${d.inside}" above:"${d.above}" left:"${d.left}"`
      )
    }
  })
  const { entries } = await llm(
    `You are filling the official Philippine form "${form.name}". You can't see it, so here is every box drawn on it: id, position in PDF points from the bottom-left, digit slots when the box is split into one-character cells, and the printed words inside / just above / just left of it. Map HERMIT's answers to boxes.

${RULES}

HERMIT answers:
${keyList(form)}

BOXES:
${lines.join("\n")}`,
    SCHEMA
  )

  // Review pass: show the model what it mapped and what it left out.
  const wanted = [...new Set([...form.fields, "owner_name", "__signature", "__today"])]
  const missing = wanted.filter((k) => !entries.some((e) => e.key === k))
  if (missing.length) {
    const more = await llm(
      `Same form and boxes as below. You already mapped: ${entries.map((e) => `${e.key}→${e.target}${e.anchor ? `@"${e.anchor}"` : ""}`).join(", ")}.
These HERMIT answers are not mapped yet: ${missing.join(", ")}. For each one the form actually asks for, add an entry (same rules). Return only the NEW entries; skip ones the form doesn't ask for.

${RULES}

HERMIT answers:
${keyList(form)}

BOXES:
${lines.join("\n")}`,
      SCHEMA
    )
    if (process.env.LAYOUT_DEBUG) console.log("review for", missing.join(","), "→", JSON.stringify(more.entries.map((e) => [e.key, e.target, e.anchor])))
    entries.push(...more.entries.filter((e) => missing.includes(e.key)))
  }

  if (process.env.LAYOUT_DEBUG) console.log(JSON.stringify(entries.map((e) => [e.key, e.target, e.part, e.anchor, e.where])))

  // Guard: for error-prone answers the box's printed label must match. Wrong
  // picks are dropped; then the topmost unused box whose label matches is used.
  // Wide context: labels on BIR forms can sit far left of their boxes.
  const context = (b) => {
    const d = describe(b, b.words)
    const cy = b.y + b.h / 2
    const farLeft = b.words.filter((w) => Math.abs(w.y + w.h / 2 - cy) < b.h / 2 + 4 && w.x + w.w <= b.x + 2 && b.x - (w.x + w.w) < 220)
    const higher = b.words.filter((w) => w.y >= b.y + b.h - 1 && w.y - (b.y + b.h) < 22 && w.x < b.x + b.w && w.x + w.w > b.x - 40)
    return `${d.inside} ${d.above} ${d.left} ${farLeft.map((w) => w.text).join(" ")} ${higher.map((w) => w.text).join(" ")}`
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    const b = boxes.get(e.target)
    const re = VERIFY[e.key]
    if (b && re && !e.anchor && !re.test(context(b))) {
      if (process.env.LAYOUT_DEBUG) console.log("dropped (label mismatch):", e.key, e.target, JSON.stringify(context(b).slice(0, 60)))
      entries.splice(i, 1)
    }
  }
  const used = new Set(entries.map((e) => e.target))
  const official = /to be filled (out )?by|for (sss|bir|official) use|household/i
  for (const [key, re] of Object.entries(VERIFY)) {
    if (!form.fields.includes(key) || entries.some((e) => e.key === key)) continue
    const label = [...boxes.values()].find((b) => !used.has(b.id) && re.test(describe(b, b.words).inside) && !official.test(describe(b, b.words).above) && b.w > 30)
    if (!label) continue
    // A label-only cell (no room to write): use the nearest box to its right on the same row.
    const roomy = label.h >= 14 || label.slots
    const b = roomy
      ? label
      : [...boxes.values()]
          .filter((r) => r.page === label.page && !used.has(r.id) && Math.abs(r.y - label.y) < 4 && r.x >= label.x + label.w - 2)
          .sort((a, c) => a.x - c.x)[0]
    if (!b) continue
    used.add(b.id)
    entries.push({ key, target: b.id, part: "full", format: /date/.test(key) ? "date" : "as_is", anchor: "", where: "fill", equals: "" })
    if (process.env.LAYOUT_DEBUG) console.log("fallback:", key, "→", b.id)
  }
  const out = []
  for (const e of entries) {
    const b = boxes.get(e.target)
    if (!b || !KEYS_OK(e.key)) {
      if (process.env.LAYOUT_DEBUG) console.log("dropped (unknown box/key):", e.key, e.target)
      continue
    }
    const inside = b.words.filter((w) => w.x + w.w / 2 > b.x && w.x + w.w / 2 < b.x + b.w && w.y + w.h / 2 > b.y && w.y + w.h / 2 < b.y + b.h)
    const base = { key: e.key, page: b.page, part: e.part, format: e.format }
    if (e.where === "mark" || e.key === "__constant") {
      const size = Math.max(5, Math.min(9, b.h * 0.85))
      out.push({ ...base, x: b.x + b.w / 2 - size * 0.33, y: b.y + b.h / 2 - size * 0.36, size, mark: true, ...(e.equals ? { equals: e.equals } : {}) })
      continue
    }
    const anchor = e.anchor ? findWord(inside, e.anchor) : undefined
    if (e.key === "__signature") {
      const w = Math.max(50, Math.min(90, b.w - 6))
      const cx = anchor ? anchor.x + anchor.w / 2 : b.x + b.w / 2
      out.push({ ...base, x: cx - w / 2, y: anchor ? anchor.y + anchor.h + 1 : b.y + 2, size: w, signature: true })
      continue
    }
    const labelBottom = inside.length ? Math.min(...inside.map((w) => w.y)) - b.y : b.h
    let x = b.x + 3
    let y
    let size
    let maxWidth = b.x + b.w - x - 2
    if (anchor && e.where === "above_anchor") {
      size = 9
      x = anchor.x
      y = anchor.y + anchor.h + 2
      maxWidth = Math.max(60, b.x + b.w - x - 2)
    } else if (anchor) {
      // Under a sub-label; the next sub-label on its line bounds the width.
      const next = inside.filter((w) => Math.abs(w.y - anchor.y) < 3 && w.x > anchor.x + anchor.w + 2).sort((a, c) => a.x - c.x)[0]
      x = anchor.x
      maxWidth = (next ? next.x : b.x + b.w) - x - 3
      size = Math.min(9, Math.max(6.5, anchor.y - b.y - 2.5))
      y = Math.max(b.y + 1.5, anchor.y - size - 1.5)
    } else if (b.slots >= 2) {
      // One character per cell (TIN, dates, phone, ZIP) — cells sit under any label.
      size = Math.min(9, Math.max(5, (inside.length ? labelBottom : b.h) * 0.75))
      out.push({ ...base, x: b.x, y: b.y + 1.5, size, pitch: b.w / b.slots, slots: b.slots })
      continue
    } else if (inside.length && labelBottom >= 6) {
      size = Math.min(9, Math.max(5, labelBottom - 2.5))
      y = b.y + 1.5
    } else if (inside.length) {
      // The label fills the box's height: write to its right.
      x = Math.max(...inside.map((w) => w.x + w.w)) + 4
      maxWidth = b.x + b.w - x - 2
      size = Math.min(9, Math.max(5, b.h - 3))
      y = b.y + (b.h - size) / 2 + 1
    } else {
      size = Math.min(9, Math.max(5, b.h * 0.62))
      y = b.y + (b.h - size) / 2 + 1
    }
    if (maxWidth < 10) {
      if (process.env.LAYOUT_DEBUG) console.log("dropped (no room):", e.key, e.target, Math.round(maxWidth))
      continue
    }
    out.push({ ...base, x, y, size, maxWidth })
  }
  return { pages: pages.map((p) => ({ w: p.w, h: p.h })), scanned: pages.some((p) => p.scanned), entries: conventions(form, pages, out) }
}

// Form conventions the model doesn't apply reliably, enforced in code.
function conventions(form, pages, entries) {
  const out = [...entries]
  const wordsOn = (p) => pages[p]?.words ?? []
  const has = (w, re) => re.test(w.text)
  const under = (w, key, extra = {}) => ({ key, page: w.page, x: w.x, y: w.y - 8.5, size: 8, maxWidth: 110, part: "full", format: "as_is", ...extra })
  pages.forEach((pg, i) => pg.words.forEach((w) => (w.page = i)))

  // 1. Wherever "(LAST NAME) (FIRST NAME) (MIDDLE NAME)" sits just above an
  //    owner-name answer, write all three parts under their sub-labels.
  for (const ref of out.filter((e) => e.key === "owner_name" && !e.pitch)) {
    if (!out.includes(ref)) continue
    const line = wordsOn(ref.page).filter((w) => w.y > ref.y - 4 && w.y - ref.y < 24)
    const last = line.find((w) => has(w, /^\(?last/i))
    const first = line.find((w) => has(w, /^\(?first/i) && Math.abs(w.y - (last?.y ?? -99)) < 4)
    if (!last || !first) continue
    const middle = line.find((w) => has(w, /^\(?middle/i) && Math.abs(w.y - last.y) < 4)
    const band = (e) => e.key === "owner_name" && e.page === ref.page && e.y < last.y && e.y > last.y - 22
    for (let i = out.length - 1; i >= 0; i--) if (band(out[i])) out.splice(i, 1)
    for (const [w, part] of [[last, "last"], [first, "first"], [middle, "middle"]])
      if (w) out.push({ key: "owner_name", page: ref.page, x: w.x, y: last.y - 9.5, size: 8, maxWidth: 100, part, format: ref.format ?? "as_is" })
  }

  // 2. Signature on the printed word SIGNATURE; name on PRINTED NAME; today on DATE.
  const sig = out.find((e) => e.key === "__signature")
  if (sig) {
    const cand = wordsOn(sig.page).filter((w) => /^signature$/i.test(w.text))
    const s = cand.sort((a, b) => Math.hypot(a.x - sig.x, a.y - sig.y) - Math.hypot(b.x - sig.x, b.y - sig.y))[0]
    if (s) {
      Object.assign(sig, { x: s.x + s.w / 2 - sig.size / 2, y: s.y + s.h + 2 })
      const line = wordsOn(sig.page).filter((w) => Math.abs(w.y - s.y) < 4)
      const printed = line.filter((w) => /^printed$/i.test(w.text)).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]
      const date = line.filter((w) => /^date$/i.test(w.text) && w.x > s.x).sort((a, b) => a.x - b.x)[0]
      const free = (w) => !out.some((e) => e.page === sig.page && Math.abs(e.y - (w.y + w.h + 2)) < 6 && Math.abs(e.x - w.x) < 40)
      if (printed && free(printed)) out.push({ ...under(printed, "owner_name"), x: printed.x - 20, y: printed.y + printed.h + 3, maxWidth: 140 })
      if (date && free(date) && !out.some((e) => e.key === "__today")) out.push({ ...under(date, "__today"), x: date.x - 6, y: date.y + date.h + 3, format: "date" })
    }
  }

  // 3. Barangay / city under their sub-labels in the first address block, if skipped.
  for (const [key, re] of [["barangay", /^\(?barangay/i], ["city", /^\(?(city|municipality)/i]]) {
    if (!form.fields.includes(key) || out.some((e) => e.key === key)) continue
    const addr = out.find((e) => e.key === "business_address")
    const w = wordsOn(addr?.page ?? 0).filter((w) => has(w, re) && (!addr || w.y < addr.y + 2)).sort((a, b) => b.y - a.y)[0]
    if (w) out.push(under(w, key))
  }

  // 4. "PRINT ALL INFORMATION IN CAPITAL LETTERS".
  if (pages.some((p) => p.words.some((w) => /^capital$/i.test(w.text))))
    for (const e of out) if (!e.mark && !e.signature && e.key !== "email" && e.format !== "date") e.format = "upper"
  return out
}

async function layoutAcro(form, pdf, bytes) {
  const pages = await analyzePdf(bytes)
  const pageRefs = pdf.getPages().map((p) => p.ref)
  const fields = []
  for (const f of pdf.getForm().getFields()) {
    const type = f instanceof PDFCheckBox ? "checkbox" : f instanceof PDFTextField ? "text" : null
    const widget = type && f.acroField.getWidgets()[0]
    if (!widget) continue
    const r = widget.getRectangle()
    const page = Math.max(0, pageRefs.findIndex((ref) => ref === widget.P()))
    const d = describe({ x: r.x, y: r.y, w: r.width, h: r.height }, pages[page]?.words ?? [])
    fields.push({ name: f.getName(), type, page, r, d })
  }
  const { entries } = await llm(
    `You are filling the fillable official Philippine form "${form.name}". Each line is a form field: name | type | page | printed words inside / above / left of it. Map HERMIT's answers to fields: target = field name, where="fill" for text fields and "mark" for checkboxes, anchor empty.

${RULES}

HERMIT answers:
${keyList(form)}

FIELDS:
${fields.map((f) => `${f.name} | ${f.type} | p${f.page + 1} | inside:"${f.d.inside}" above:"${f.d.above}" left:"${f.d.left}"`).join("\n")}`,
    SCHEMA
  )
  // Review pass, as for flat forms: ask again for answers it left out.
  const listing = fields.map((f) => `${f.name} | ${f.type} | p${f.page + 1} | inside:"${f.d.inside}" above:"${f.d.above}" left:"${f.d.left}"`).join("\n")
  const missing = [...new Set([...form.fields, "owner_name"])].filter((k) => !entries.some((e) => e.key === k))
  if (missing.length) {
    const more = await llm(
      `Same fillable form "${form.name}" and fields as below. Already mapped: ${entries.map((e) => `${e.key}→${e.target}`).join(", ")}.
Not mapped yet: ${missing.join(", ")}. For each one the form asks for (including checkboxes for choice fields like type of organization or whether the property is owned), add entries. Return only NEW entries.

${RULES}

HERMIT answers:
${keyList(form)}

FIELDS:
${listing}`,
      SCHEMA
    )
    if (process.env.LAYOUT_DEBUG) console.log("review for", missing.join(","), "→", JSON.stringify(more.entries.map((e) => [e.key, e.target, e.equals])))
    entries.push(...more.entries.filter((e) => missing.includes(e.key)))
  }
  const byName = new Map(fields.map((f) => [f.name, f]))
  const out = []
  for (const e of entries) {
    const f = byName.get(e.target)
    if (!f || !KEYS_OK(e.key) || e.key === "__signature") continue
    const size = Math.max(5, Math.min(9, f.r.height - 2))
    const base = { key: e.key, page: f.page, part: e.part, format: e.format, pdfField: f.name }
    if (f.type === "checkbox") out.push({ ...base, x: f.r.x + 1, y: f.r.y + 1, size, mark: true, ...(e.equals ? { equals: e.equals } : {}) })
    else out.push({ ...base, x: f.r.x + 2, y: f.r.y + Math.max(1.5, (f.r.height - size) / 2), size, maxWidth: f.r.width - 4 })
  }
  return { pages: pages.map((p) => ({ w: p.w, h: p.h })), scanned: false, entries: out }
}

const layouts = { ...previous }
const jobs = []
for (const form of FORMS) {
  for (const file of MANIFEST[form.id] ?? []) {
    if (file.kind !== "form" || !file.path.endsWith(".pdf")) continue
    if (only && !file.path.includes(only)) continue
    const old = previous[file.path]
    if (old && old.sha256 === file.sha256 && old.version === 2 && !process.argv.includes("--force")) {
      console.log(`= ${file.path} (unchanged)`)
      continue
    }
    jobs.push({ form, file })
  }
}
// A few forms at a time: each waits mostly on the model.
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const { form, file } = job
    try {
      const bytes = await (await fetch(BASE + file.path)).arrayBuffer()
      let fillable = false
      let pdf
      try {
        pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
        fillable = pdf.getForm().getFields().length > 0
      } catch {}
      const layout = fillable ? await layoutAcro(form, pdf, bytes) : await layoutFlat(form, bytes)
      layouts[file.path] = { version: 2, formId: form.id, sha256: file.sha256, fillable, ...layout, generatedAt: new Date().toISOString(), model: MODEL }
      console.log(`✓ ${file.path}: ${layout.entries.length} placements${fillable ? " (fillable)" : layout.scanned ? " (scanned, OCR)" : ""}`)
    } catch (e) {
      console.log(`✗ ${file.path}: ${e.message}`)
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
await closeOcr()
writeFileSync(OUT, `${JSON.stringify(layouts, null, 1)}\n`)
