import { getRequirement } from "./engine"
import { draftKey, initialBoxes, pdfSafe, type Box, type Layout } from "./fill"
import layouts from "./form-layouts.json"
import { fillForm, filingTask, formsFor, type FilingTask, type FormTemplate } from "./forms"
import type { FormMemory } from "./form-memory"
import { libraryFiles, type LibraryFile } from "./library"
import { officesFor } from "./offices"
import { jurisdictionLabel } from "./locations"
import { processFor } from "./processes"
import type { Profile, VaultDoc } from "./types"
import { coverage, DOC_TYPES, type SlotStatus } from "./vault"

// A document packet: everything Kuya Hermit suggested for one requirement,
// filled in and merged into one ready-to-print PDF. Kuya Hermit only plans it
// (after the owner says yes); the PDF is built on the owner's device, so their
// details and vault files never leave it.

export type PacketPlan = {
  requirement: NonNullable<ReturnType<typeof getRequirement>>
  task: FilingTask
  forms: { form: FormTemplate; reason: string; file?: LibraryFile; layout?: Layout; missing: string[] }[]
  needs: SlotStatus[] // documents to bring, with the owner's vault copy when there is one
  letter: boolean // property owner's consent letter, when no lease/title is on file
}

export const usable = (s: SlotStatus) => s.doc?.verdict === "verified"
export const slotAvailability = (s: SlotStatus) =>
  usable(s) ? "verified copy" : s.doc?.verdict === "needs_review" ? "awaiting review" : s.doc ? "unavailable: rejected" : "not in your vault"
export const slotName = (s: SlotStatus) => s.types.map((t) => DOC_TYPES[t].name).join(" / ")

export type FormContext = {
  task?: FilingTask
  memory?: FormMemory
  edits?: Record<string, Record<string, string>>
  ownerId?: string | null
  drafts?: Record<string, Box[]>
}

export function packetPlan(
  requirementId: string,
  profile: Profile,
  docs: VaultDoc[],
  context: FormContext = {}
): PacketPlan | null {
  const requirement = getRequirement(requirementId)
  if (!requirement) return null
  const task = context.task ?? filingTask(requirementId)
  const forms = formsFor(requirementId, profile, task).map((form) => {
    const file = libraryFiles(form.id, profile).find((f) => f.kind === "form" && f.path.endsWith(".pdf"))
    const layout = file ? (layouts as Record<string, Layout>)[file.path] : undefined
    return {
      form,
      reason: `${task}: ${form.purpose}`,
      file,
      layout,
      missing: fillForm(form, profile, context.memory, context.edits?.[form.id])
        .filter((f) => f.missing)
        .map((f) => f.label),
    }
  })
  const needs = coverage(requirementId, docs)?.needs ?? []
  const letter = profile.premises !== "owned" && needs.some((s) => s.types.includes("lease") && !usable(s))
  return { requirement, task, forms, needs, letter }
}

const A4: [number, number] = [595.28, 841.89]

export async function buildPacket(
  plan: PacketPlan,
  profile: Profile,
  fetchDoc: (d: VaultDoc) => Promise<Blob | undefined>,
  context: FormContext = {}
) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib")
  const { drawBoxes } = await import("./pdf-draw")
  const en = profile.lang === "en"
  const t = (fil: string, eng: string) => (en ? eng : fil)
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const values = (f: FormTemplate) =>
    Object.fromEntries(
      fillForm(f, profile, context.memory, context.edits?.[f.id]).map((v) => [v.key, v.value])
    )
  const today = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })

  // Flowing text on A4 pages.
  function sheet() {
    let page = out.addPage(A4)
    let y = 790
    const line = (text: string, o: { size?: number; b?: boolean; indent?: number } = {}) => {
      const size = o.size ?? 10.5
      const f = o.b ? bold : font
      const width = 495 - (o.indent ?? 0)
      const words = pdfSafe(text).split(" ")
      let cur = ""
      const lines: string[] = []
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w
        if (cur && f.widthOfTextAtSize(next, size) > width) {
          lines.push(cur)
          cur = w
        } else cur = next
      }
      lines.push(cur)
      for (const l of lines) {
        if (y < 60) {
          page = out.addPage(A4)
          y = 790
        }
        page.drawText(l, { x: 50 + (o.indent ?? 0), y, size, font: f })
        y -= size + 4
      }
    }
    const space = (h = 8) => void (y -= h)
    return { line, space }
  }

  // Prepare and copy once before the cover; its claims use these exact outcomes.
  const prepared = await Promise.all(plan.forms.map(async (f) => {
    try {
      if (!f.file || !f.layout) throw new Error("No mapped official PDF available")
      const res = await fetch(f.file.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const src = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true })
      if (!src.getPageCount()) throw new Error("Official PDF has no pages")
      const boxes = context.ownerId ? context.drafts?.[draftKey(context.ownerId, f.file.path, f.layout)] : undefined
      const srcFont = await src.embedFont(StandardFonts.Helvetica)
      const acro = await drawBoxes(src, boxes ?? initialBoxes(f.layout, values(f.form)).boxes, srcFont)
      acro?.updateFieldAppearances(srcFont)
      acro?.flatten()
      return { ...f, pages: await out.copyPages(src, src.getPageIndices()), why: undefined }
    } catch (error) {
      return { ...f, pages: [], why: error instanceof Error ? error.message : "Official PDF could not be prepared" }
    }
  }))
  const attached = []
  for (const slot of plan.needs) {
    const name = slot.doc ? DOC_TYPES[slot.types.find((x) => x === slot.doc!.extracted.docType) ?? slot.types[0]].name : slotName(slot)
    let pages: import("pdf-lib").PDFPage[] = []
    let why: string | undefined
    try {
      if (!usable(slot)) throw new Error(slotAvailability(slot))
      const blob = await fetchDoc(slot.doc!)
      if (!blob) throw new Error("file couldn't be loaded")
      const bytes = await blob.arrayBuffer()
      let src
      if (blob.type === "application/pdf") {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true })
        if (!src.getPageCount()) throw new Error("PDF has no pages")
      } else if (["image/png", "image/jpeg"].includes(blob.type)) {
        src = await PDFDocument.create()
        const img = blob.type === "image/png" ? await src.embedPng(bytes) : await src.embedJpg(bytes)
        const page = src.addPage(A4)
        const scale = Math.min(495 / img.width, 700 / img.height, 1)
        const labelFont = await src.embedFont(StandardFonts.HelveticaBold)
        page.drawText(pdfSafe(name), { x: 50, y: 800, size: 10, font: labelFont })
        page.drawImage(img, { x: 50, y: 780 - img.height * scale, width: img.width * scale, height: img.height * scale })
      } else throw new Error(`unsupported file type ${blob.type || "unknown"}; convert to PDF, PNG or JPEG`)
      pages = await out.copyPages(src, src.getPageIndices())
    } catch (error) {
      why = error instanceof Error ? error.message : "file couldn't be decoded or embedded"
    }
    attached.push({ slot, name, pages, why })
  }

  // 1. Cover page and checklist
  const c = sheet()
  c.line(`HERMIT · ${plan.requirement.name}`, { size: 18, b: true })
  c.line([profile.businessName, profile.ownerName].filter(Boolean).join(" · "))
  c.line(`Jurisdiction: ${jurisdictionLabel(profile)} · Filing task: ${plan.task}`, { size: 9 })
  c.line(t(`Inihanda noong ${today}`, `Prepared ${today}`), { size: 9 })
  c.space(12)
  c.line(t("LAMAN NG PACKET NA ITO", "IN THIS PACKET"), { b: true })
  let n = 1
  for (const f of prepared) {
    c.line(`${n++}. ${f.form.name}${f.pages.length ? t(" (opisyal na form, napunan na)", " (official form, filled in)") : t(" (info sheet: kopyahin sa form ng opisina)", " (info sheet: copy onto the office's form)")}`, { indent: 8 })
    c.line(f.reason, { indent: 16, size: 9 })
    if (f.why) c.line(`Info sheet: ${f.why}`, { indent: 16, size: 9 })
  }
  if (plan.letter) c.line(`${n++}. ${t("Liham ng pahintulot ng may-ari ng lugar (papirmahan sa may-ari)", "Property owner's consent letter (for the owner to sign)")}`, { indent: 8 })
  for (const a of attached.filter((a) => a.pages.length)) c.line(`${n++}. ${t("Kopya mula sa vault", "Vault copy")}: ${a.name}`, { indent: 8 })
  for (const a of attached.filter((a) => a.why)) c.line(`Unavailable / omitted: ${a.name} (${a.why})`, { indent: 8 })
  c.space()
  c.line(t("DALHIN (original + photocopy)", "BRING (original + photocopy)"), { b: true })
  for (const a of attached) c.line(`[${a.pages.length ? "x" : "  "}] ${slotName(a.slot)} (${a.why ?? "verified copy included"})`, { indent: 8 })
  for (const d of plan.requirement.documents) c.line(`- ${d}`, { indent: 8, size: 9.5 })
  const blanks = plan.forms.filter((f) => f.missing.length)
  if (blanks.length) {
    c.space()
    c.line(t("BLANKO PA (sagutan bago i-file)", "STILL BLANK (fill in before filing)"), { b: true })
    for (const f of blanks) c.line(`${f.form.short}: ${f.missing.join(", ")}`, { indent: 8 })
  }
  c.space()
  c.line(t("SAAN MAG-FILE", "WHERE TO FILE"), { b: true })
  c.line(plan.requirement.whereToFile, { indent: 8 })
  for (const o of officesFor(profile.city, profile.barangay, new Set([plan.requirement.officeType]), profile)) c.line(`${o.name}${o.url ? ` · ${o.url}` : ""}`, { indent: 8 })
  const process = processFor(plan.requirement.id, profile, plan.task)
  if (process?.office) c.line(process.office, { indent: 8 })
  if (process?.note) c.line(process.note, { indent: 8, size: 9 })
  for (const l of process?.links ?? []) c.line(`${l.label}: ${l.url}`, { indent: 8 })
  c.space(14)
  c.line(
    t(
      "Suriin ang bawat pahina at pumirma kung saan kailangan. Hindi nagsa-submit ang HERMIT: ikaw ang magpa-file. Hindi ito legal o tax advice.",
      "Check every page and sign where needed. HERMIT never submits anything: you file it yourself. Not legal or tax advice."
    ),
    { size: 9 }
  )

  // 2. Forms: the official PDF filled in (with the owner's own edits, if any), else an info sheet.
  for (const f of prepared) {
    if (f.pages.length) {
      for (const page of f.pages) out.addPage(page)
      continue
    }
    const s = sheet()
    s.line(f.form.name, { size: 15, b: true })
    s.line(`${f.form.agency} · ${t("Saan", "Where")}: ${f.form.portal}`, { size: 9 })
    s.line(t("Kopyahin ang mga sagot na ito sa form ng opisina.", "Copy these answers onto the office's form."), { size: 9 })
    s.space(10)
    for (const v of fillForm(
      f.form,
      profile,
      context.memory,
      context.edits?.[f.form.id]
    )) {
      s.line(v.label, { size: 9, b: true })
      s.line(v.value || "______________________________", { indent: 8 })
      s.space(3)
    }
  }

  // 3. Consent letter for the property owner to sign.
  if (plan.letter) {
    const s = sheet()
    s.line(today)
    s.space(14)
    s.line("The Business Permits and Licensing Office", { b: true })
    s.line(profile.city ? `City / Municipality of ${profile.city}` : "City / Municipal Hall")
    s.space(14)
    s.line("CONSENT OF PROPERTY OWNER", { size: 13, b: true })
    s.space(6)
    s.line(
      `I, ________________________________, of legal age, am the owner of the property at ${profile.businessAddress || "________________________________"}. I allow ${profile.ownerName || "________________"} to use this property for the business "${profile.businessName || "________________"}"${profile.description ? ` (${profile.description})` : ""}${profile.premises === "rented" ? " under our lease agreement" : ""}, and I consent to the application for its barangay clearance and business permit.`
    )
    s.space(6)
    s.line("Issued this ____ day of ______________, 20____.")
    s.space(40)
    s.line("________________________________")
    s.line("Signature over printed name of property owner", { size: 9 })
    s.line("Contact no.: ____________________", { size: 9 })
    s.space(20)
    s.line("Attach: a copy of the property owner's valid ID and proof of ownership (TCT or tax declaration).", { size: 9 })
    s.line(
      "Paalala: ang may-ari ng lugar ang dapat pumirma nito. Kung may kontrata ng upa (lease), iyon ang dalhin. Ang ilang LGU ay may sariling format; itanong sa BPLO.",
      { size: 9 }
    )
  }

  // 4. The owner's own documents from the vault.
  for (const a of attached) for (const page of a.pages) out.addPage(page)

  return out.save()
}
