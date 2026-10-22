// "Sees" a form page for a text-only model: renders it, finds every drawn
// box (ruled-line cell detection), and reads every word (PDF text layer, or
// OCR for scanned forms). Used by scripts/layout-forms.mjs.
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { getDocumentProxy, renderPageAsImage } from "unpdf"

export const SCALE = 4 // render at 216 dpi

let ocrWorker
async function readWords(png, mode) {
  await ocrWorker.setParameters({ tessedit_pageseg_mode: mode })
  const { data } = await ocrWorker.recognize(Buffer.from(png), {}, { blocks: true })
  const words = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words)
    if (w.text.trim() && w.confidence > 15) words.push({ text: w.text.trim(), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })
  return words
}
// Two passes: auto layout reads headings and labels in lines; sparse-text
// mode finds the small scattered sub-labels. Keep sparse words that don't
// overlap a word from the first pass.
// One OCR job at a time: both passes share a worker and its page-segmentation mode.
let ocrQueue = Promise.resolve()
const ocr = (png) => {
  const run = ocrQueue.then(() => ocrOnce(png))
  ocrQueue = run.catch(() => {})
  return run
}
async function ocrOnce(png) {
  if (!ocrWorker) {
    const { createWorker } = await import("tesseract.js")
    ocrWorker = await createWorker("eng")
  }
  const main = await readWords(png, "3")
  const overlaps = (a, b) => {
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
    const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
    return ix * iy > 0.3 * Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))
  }
  for (const w of await readWords(png, "11")) if (!main.some((m) => overlaps(m, w))) main.push(w)
  return main
}
export async function closeOcr() {
  await ocrWorker?.terminate()
  ocrWorker = undefined
}

// Ruled lines → cells: mark long horizontal/vertical dark runs, then the
// connected regions between them are the boxes.
function findBoxes(gray, W, H) {
  const dark = (i) => gray[i] < 150
  const line = new Uint8Array(W * H)
  const MIN = 6 * SCALE // ≥ 6pt long counts as a ruled line, not a letter stroke
  for (let y = 0; y < H; y++) {
    let start = -1
    for (let x = 0; x <= W; x++) {
      const d = x < W && dark(y * W + x)
      if (d && start < 0) start = x
      if (!d && start >= 0) {
        if (x - start >= MIN) for (let k = start; k < x; k++) line[y * W + k] = 1
        start = -1
      }
    }
  }
  for (let x = 0; x < W; x++) {
    let start = -1
    for (let y = 0; y <= H; y++) {
      const d = y < H && dark(y * W + x)
      if (d && start < 0) start = y
      if (!d && start >= 0) {
        if (y - start >= MIN) for (let k = start; k < y; k++) line[k * W + x] = 1
        start = -1
      }
    }
  }
  // Close 1px gaps in scanned lines.
  const closed = line.slice()
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (!line[y * W + x] && ((line[y * W + x - 1] && line[y * W + x + 1]) || (line[(y - 1) * W + x] && line[(y + 1) * W + x]))) closed[y * W + x] = 1

  const label = new Int32Array(W * H)
  const boxes = []
  const stack = []
  let id = 0
  for (let s = 0; s < W * H; s++) {
    if (closed[s] || label[s]) continue
    id++
    let [x0, y0, x1, y1, n] = [W, H, 0, 0, 0]
    label[s] = id
    stack.push(s)
    while (stack.length) {
      const i = stack.pop()
      const x = i % W
      const y = (i - x) / W
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
        if (j >= 0 && !closed[j] && !label[j]) {
          label[j] = id
          stack.push(j)
        }
    }
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const touchesEdge = x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1
    if (touchesEdge || w < 4 * SCALE || h < 5 * SCALE || w * h > W * H * 0.3 || n / (w * h) < 0.6) continue
    // Short vertical ticks rising from the bottom edge = one-character slots (TIN, dates).
    let ticks = 0
    let prev = -10
    for (let x = x0 + 2; x < x1 - 1; x++) {
      let run = 0
      for (let y = y1; y > y0 && dark(y * W + x); y--) run++
      if (run >= h * 0.15 && run <= h * 0.75) {
        if (x - prev > 2) ticks++
        prev = x
      }
    }
    boxes.push({ x0, y0, x1, y1, ticks })
  }
  return boxes
}

export async function analyzePdf(bytes) {
  const data = new Uint8Array(bytes)
  const pdf = await getDocumentProxy(data.slice())
  const pages = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const [, , pw, ph] = page.view
    const png = await renderPageAsImage(data.slice(), p, { canvasImport: () => import("@napi-rs/canvas"), scale: SCALE })
    const img = await loadImage(Buffer.from(png))
    const W = img.width
    const H = img.height
    const ctx = createCanvas(W, H).getContext("2d")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0)
    const rgba = ctx.getImageData(0, 0, W, H).data
    const gray = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) gray[i] = (rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11) | 0

    const sx = pw / W
    const sy = ph / H
    // Words in PDF points (y from the bottom), from the text layer or OCR.
    const { items } = await page.getTextContent()
    let words = items
      .filter((it) => it.str?.trim())
      .map((it) => ({ text: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) || 7 }))
    const scanned = words.length < 15
    if (scanned)
      words = (await ocr(png)).map((w) => ({ text: w.text, x: w.x0 * sx, y: ph - w.y1 * sy, w: (w.x1 - w.x0) * sx, h: (w.y1 - w.y0) * sy }))

    const boxes = findBoxes(gray, W, H).map((b, i) => ({
      id: `p${p}b${i + 1}`,
      page: p - 1,
      x: b.x0 * sx,
      y: ph - (b.y1 + 1) * sy,
      w: (b.x1 - b.x0 + 1) * sx,
      h: (b.y1 - b.y0 + 1) * sy,
      slots: b.ticks >= 2 ? b.ticks + 1 : 0,
    }))
    pages.push({ w: pw, h: ph, scanned, words, boxes, png })
  }
  return pages
}

// Words inside / just above / just left of a box, for the model's description.
export function describe(box, words) {
  const cx = (w) => w.x + w.w / 2
  const cy = (w) => w.y + w.h / 2
  const inside = words.filter((w) => cx(w) > box.x && cx(w) < box.x + box.w && cy(w) > box.y && cy(w) < box.y + box.h)
  const above = words.filter((w) => w.y >= box.y + box.h - 1 && w.y - (box.y + box.h) < 11 && w.x < box.x + box.w && w.x + w.w > box.x)
  const left = words.filter((w) => cy(w) > box.y && cy(w) < box.y + box.h && w.x + w.w <= box.x + 2 && box.x - (w.x + w.w) < 70)
  const join = (ws) => ws.sort((a, b) => b.y - a.y || a.x - b.x).map((w) => w.text).join(" ").slice(0, 90)
  return { inside: join(inside), above: join(above), left: join(left), insideTop: inside.length ? Math.max(...inside.map((w) => w.y + w.h)) - box.y : 0, insideBottom: inside.length ? Math.min(...inside.map((w) => w.y)) - box.y : box.h }
}
