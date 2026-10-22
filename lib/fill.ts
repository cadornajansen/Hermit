// Turns a stored form layout (lib/form-layouts.json) plus the owner's values
// into editable boxes for the PDF editor. Pure: no PDF or DOM code here.

export type LayoutEntry = {
  key: string
  page: number
  x: number
  y: number // PDF points from the bottom-left; text baseline
  size: number
  equals?: string
  mark?: boolean
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
  id: string
  page: number
  x: number
  y: number // text: baseline; signature: bottom edge
  size: number // text: font size; signature: width in points
  kind: "text" | "mark" | "signature"
  text: string
  image?: string // signature PNG data URL
  aspect?: number // signature height / width
  key?: string
  pdfField?: string
}

let n = 0
export const boxId = () => `b${Date.now().toString(36)}${(n++).toString(36)}`

export function initialBoxes(layout: Layout, values: Record<string, string>): Box[] {
  const boxes: Box[] = []
  for (const e of layout.entries) {
    const value = values[e.key] ?? ""
    if (e.mark) {
      // Choice fields: mark the option that matches what HERMIT knows.
      if (value && e.equals && value === e.equals)
        boxes.push({ id: boxId(), page: e.page, x: e.x, y: e.y, size: e.size, kind: "mark", text: "X", key: e.key, pdfField: e.pdfField })
    } else if (value) {
      boxes.push({ id: boxId(), page: e.page, x: e.x, y: e.y, size: e.size, kind: "text", text: value, key: e.key, pdfField: e.pdfField })
    }
  }
  return boxes
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
