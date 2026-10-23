// Turns a stored form layout (lib/form-layouts.json) plus the owner's values
// into ready-to-print boxes for the PDF editor. Pure: no PDF or DOM code.

export type LayoutEntry = {
  key: string
  page: number
  x: number
  y: number // PDF points from the bottom-left; text baseline (signature: bottom edge)
  size: number // font size; signature: width
  part?: "full" | "last" | "first" | "middle" | "suffix"
  format?: "as_is" | "upper" | "date"
  maxWidth?: number
  pitch?: number // one character per cell (TIN, dates, ZIP)
  slots?: number
  equals?: string
  mark?: boolean
  signature?: boolean
  pdfField?: string
}

export type Layout = {
  formId: string
  sha256: string
  fillable: boolean
  pages: { w: number; h: number }[]
  entries: LayoutEntry[]
}

export type Box = {
  reusable?: boolean // full mapped answer, never a split name or unlabelled text
  id: string
  page: number
  x: number
  y: number // text: baseline; signature: bottom edge
  size: number // text: font size; signature: width in points
  kind: "text" | "mark" | "signature"
  text: string
  pitch?: number
  image?: string // signature PNG data URL
  aspect?: number // signature height / width
  key?: string
  pdfField?: string
}

export type SignatureSlot = { page: number; x: number; y: number; width: number }

let n = 0
// Session drafts are scoped to the owner and layout version; legacy unscoped
// localStorage drafts are never read (they may belong to another owner).
export const draftKey = (
  ownerId: string,
  path: string,
  layout: Layout | null
) =>
  `hermit:fill:${ownerId}:${path}:${layout?.sha256 ?? "manual"}:${(layout as { generatedAt?: string } | null)?.generatedAt ?? "manual"}`

export const boxId = () => `b${Date.now().toString(36)}${(n++).toString(36)}`

// Filipino surnames often carry particles: "Dela Cruz", "De los Santos", "San Juan".
const PARTICLES = new Set(["de", "del", "dela", "della", "delos", "la", "las", "los", "san", "santa", "sta", "sta.", "sto", "sto.", "santo", "van", "von", "di", "da"])

export function splitName(full: string) {
  const t = full.trim().split(/\s+/).filter(Boolean)
  const suffix = t.length > 1 && /^(jr\.?|sr\.?|ii|iii)$/i.test(t.at(-1)!) ? t.pop()! : ""
  if (t.length <= 1) return { first: t[0] ?? "", middle: "", last: "", suffix }
  let k = t.length - 1
  while (k > 1 && PARTICLES.has(t[k - 1].toLowerCase())) k--
  const last = t.slice(k).join(" ")
  if (k === 1) return { first: t[0], middle: "", last, suffix }
  return { first: t.slice(0, k - 1).join(" "), middle: t[k - 1], last, suffix }
}

export function formatDate(v: string) {
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`
}

function valueFor(e: LayoutEntry, values: Record<string, string>, today: Date) {
  let v = e.key === "__today" ? today.toISOString().slice(0, 10) : (values[e.key] ?? "")
  if (v && e.part && e.part !== "full") v = splitName(v)[e.part]
  if (v && (e.format === "date" || e.key === "__today")) v = formatDate(v)
  if (v && e.format === "upper") v = v.toUpperCase()
  if (v && e.pitch) v = v.replace(/^\+63/, "0").replace(/[^0-9A-Za-zÑñ]/g, "")
  return v
}

// Helvetica averages ~0.52em per lowercase character and ~0.67em per capital:
// shrink long answers to fit their box.
function fit(text: string, size: number, maxWidth?: number) {
  const em = text === text.toUpperCase() ? 0.67 : 0.52
  return maxWidth && text.length * size * em > maxWidth ? Math.max(4.5, maxWidth / (text.length * em)) : size
}

export function initialBoxes(layout: Layout, values: Record<string, string>, today = new Date()) {
  const boxes: Box[] = []
  let signature: SignatureSlot | undefined
  for (const e of layout.entries) {
    if (e.signature) {
      signature ??= { page: e.page, x: e.x, y: e.y, width: e.size }
      continue
    }
    if (e.mark) {
      // Choice fields: mark only the option that matches what HERMIT knows.
      const on = e.key === "__constant" || (!!e.equals && values[e.key] === e.equals)
      if (on) boxes.push({ id: boxId(), page: e.page, x: e.x, y: e.y, size: e.size, kind: "mark", text: "X", key: e.key, pdfField: e.pdfField })
      continue
    }
    const text = valueFor(e, values, today)
    if (!text) continue
    // More characters than cells: write it as ordinary text instead of cutting it off.
    const cells = e.pitch && (!e.slots || text.length <= e.slots) ? e.pitch : undefined
    const width = e.pitch && e.slots ? e.pitch * e.slots : e.maxWidth
    boxes.push({
      id: boxId(),
      page: e.page,
      x: e.x,
      y: e.y,
      size: cells ? e.size : fit(text, e.size, width),
      kind: "text",
      text,
      pitch: cells,
      key: e.key,
      pdfField: e.pdfField,
      reusable: !e.part || e.part === "full",
    })
  }
  return { boxes, signature }
}

// Only whole mapped answers are safe to reuse. Split names and conflicting
// repeated boxes need explicit review on the field sheet instead of guessing.
export function answersFromBoxes(boxes: Box[]) {
  const values: Record<string, string> = {}
  const conflicts = new Set<string>()
  for (const box of boxes) {
    if (box.kind !== "text" || !box.key || !box.reusable) continue
    if (Object.hasOwn(values, box.key) && values[box.key] !== box.text)
      conflicts.add(box.key)
    values[box.key] = box.text
  }
  for (const key of conflicts) delete values[key]
  return values
}

// The standard PDF fonts only cover WinAnsi (Latin-1-ish). Keep ñ/é etc.,
// spell out the peso sign, and drop anything else rather than failing export.
export function pdfSafe(text: string) {
  return text
    .replace(/₱/g, "PHP ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "")
}
