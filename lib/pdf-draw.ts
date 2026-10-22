import { PDFCheckBox, PDFTextField, type PDFDocument, type PDFFont } from "pdf-lib"

import { pdfSafe, type Box } from "./fill"

// Writes filled-in boxes onto a loaded PDF: real form fields where the PDF
// has them, drawn text / marks / signature everywhere else. Shared by the
// form editor's download and Kuya Hermit's document packets.
export async function drawBoxes(pdf: PDFDocument, boxes: Box[], font: PDFFont) {
  const pages = pdf.getPages()
  let acro: ReturnType<PDFDocument["getForm"]> | null = null
  try {
    acro = pdf.getForm()
  } catch {}
  for (const b of boxes) {
    const page = pages[b.page]
    if (!page) continue
    const field = b.pdfField && acro ? acro.getFields().find((f) => f.getName() === b.pdfField) : undefined
    if (field instanceof PDFTextField) {
      field.setText(pdfSafe(b.text))
      continue
    }
    if (field instanceof PDFCheckBox) {
      field.check()
      continue
    }
    if (b.kind === "signature" && b.image) {
      const png = await pdf.embedPng(b.image)
      page.drawImage(png, { x: b.x, y: b.y, width: b.size, height: b.size * (b.aspect ?? 0.4) })
    } else if (b.pitch) {
      ;[...pdfSafe(b.text)].forEach((ch, i) =>
        page.drawText(ch, { x: b.x + i * b.pitch! + (b.pitch! - font.widthOfTextAtSize(ch, b.size)) / 2, y: b.y, size: b.size, font })
      )
    } else page.drawText(pdfSafe(b.text), { x: b.x, y: b.y, size: b.size, font })
  }
  return acro
}
