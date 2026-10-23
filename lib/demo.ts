import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { BUCKET, db } from "@/lib/db"
import { DEMO_OWNER } from "@/lib/demo-id"
import { buildCalendar, buildChecklist, EMPTY_PROFILE } from "@/lib/engine"
import { restoreLocation } from "@/lib/locations"
import type { DocType, ItemState, Profile, VaultDoc } from "@/lib/types"
import { EMPTY_EXTRACTED, verifyDocument } from "@/lib/vault"

// A complete, consistent sample business for demos: Juana's carinderia in
// Taguig, registered and running, with some permits done, two filings in
// progress, past taxes paid and this quarter's tax still to pay. Every date is
// relative to today so the demo looks the same whenever it's opened.

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
const year = new Date().getFullYear()
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

export const DEMO_IDENTITY = {
  uniqid: "HERMIT-DEMO",
  firstName: "Juana",
  middleName: "Santos",
  lastName: "Dela Cruz",
  suffix: "",
  birthDate: "1985-06-12",
  address: "123 Pioneer St., Western Bicutan, Taguig City",
  barangay: "Western Bicutan",
  municipality: "Taguig",
  mobile: "+639171234567",
  email: "juana.demo@example.com",
  gender: "female",
  regionCode: "",
  provinceCode: "",
  municipalityCode: "",
  barangayCode: "",
}

function demoProfile(): Profile {
  return restoreLocation({
    ...EMPTY_PROFILE,
    ownerName: "Juana Santos Dela Cruz",
    birthDate: DEMO_IDENTITY.birthDate,
    homeAddress: DEMO_IDENTITY.address,
    mobile: DEMO_IDENTITY.mobile,
    email: DEMO_IDENTITY.email,
    identityVerified: true,
    businessName: "Nena's Carinderia",
    description: "Carinderia selling lutong ulam and rice meals, dine-in and take-out",
    category: "food_service",
    activities: ["food_service"],
    packagedFood: false,
    psic: "5610",
    stage: "registered",
    structure: "sole",
    businessAddress: "45 Pioneer St.",
    barangay: "Western Bicutan",
    city: "Taguig",
    premises: "rented",
    channel: "physical",
    assets: "under_3m",
    sales: "500k_3m",
    taxOption: "graduated",
    employees: "1_9",
    flags: { food: true, alcohol: false, fda: false, fuel: false, security: false, lending: false, import_export: false, transport: false, construction: false, professional: false },
    lang: "fil",
    reminders: ["sms"],
    tin: "219-000-689-000",
    rdoCode: "044",
    dtiNo: "4210388",
    memory: [
      { id: "m1", text: "Plans to hire one more cook in December", source: "chat", at: ago(9 * 86_400_000) },
      { id: "m2", text: "Rents the space from her tita; the lease renews every February", source: "chat", at: ago(30 * 86_400_000) },
      { id: "m3", text: "Prefers SMS reminders over email", source: "owner", at: ago(40 * 86_400_000) },
    ],
    appointments: [{ id: "a1", office: "BIR RDO 44, Taguig-Pateros", at: `${day(4)}T09:30`, purpose: "Update registration (new branch address)", demo: true }],
  })
}

const ITEMS: Record<string, ItemState> = {
  dti_bn: { status: "approved", expiresOn: "2029-03-14" },
  brgy_clearance: { status: "approved", expiresOn: `${year}-12-31` },
  mayors_permit: { status: "approved", expiresOn: `${year}-12-31` },
  sanitary_permit: { status: "approved", expiresOn: `${year}-12-31` },
  health_certs: { status: "approved", expiresOn: day(23) },
  bir_cor: { status: "approved" },
  bir_books: { status: "approved" },
  bir_invoices: { status: "approved" },
  bir_display: { status: "approved" },
  tax_option: { status: "approved" },
  fsic: { status: "submitted" },
  sss_er: { status: "submitted" },
  philhealth_er: { status: "in_progress" },
  pagibig_er: { status: "in_progress" },
}

// Documents in the vault: [type, file name, requirement, number, issued, expires]
const DOCS: [DocType, string, string, string, string, string][] = [
  ["valid_id", "PhilSys National ID.pdf", "dti_bn", "PSN-SAMPLE-0000-0001", "2023-05-02", "2033-05-02"],
  ["dti_cert", "DTI Business Name Certificate.pdf", "brgy_clearance", "4210388", "2024-03-14", "2029-03-14"],
  ["bir_cor", "BIR Certificate of Registration 2303.pdf", "bir_cor", "OCN-SAMPLE-044-2024", "2024-04-02", ""],
  ["lease", "Contract of Lease - 45 Pioneer St.pdf", "mayors_permit", "", "2024-02-01", ""],
  ["cedula", `Cedula ${year}.pdf`, "brgy_clearance", `CTC-${year}-SAMPLE-118`, `${year}-01-05`, `${year}-12-31`],
  ["brgy_clearance", `Barangay Clearance ${year}.pdf`, "mayors_permit", `WB-${year}-0457`, `${year}-01-08`, `${year}-12-31`],
  ["mayors_permit", `Mayor's Permit ${year}.pdf`, "mayors_permit", `TGG-BP-${year}-SAMPLE`, `${year}-01-20`, `${year}-12-31`],
  ["sanitary_permit", `Sanitary Permit ${year}.pdf`, "sanitary_permit", `SP-${year}-SAMPLE-22`, `${year}-01-27`, `${year}-12-31`],
  ["health_cert", "Health Certificate - Juana.pdf", "health_certs", `HC-${year}-SAMPLE-301`, day(-342), day(23)],
]

const NAMES: Partial<Record<DocType, string>> = {
  valid_id: "Valid government ID",
  dti_cert: "DTI Business Name Certificate",
  bir_cor: "BIR Certificate of Registration (Form 2303)",
  lease: "Contract of lease",
  cedula: "Community Tax Certificate",
  brgy_clearance: "Barangay Business Clearance",
  mayors_permit: "Mayor's / Business Permit",
  sanitary_permit: "Sanitary Permit",
  health_cert: "Health Certificate",
}

// A plainly labelled stand-in file, so the vault and packets have something to open.
async function samplePdf(title: string, lines: string[]) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawRectangle({ x: 40, y: 740, width: 515, height: 60, color: rgb(1, 0.95, 0.8) })
  page.drawText("HERMIT DEMO - SAMPLE DOCUMENT", { x: 56, y: 772, size: 16, font: bold, color: rgb(0.6, 0.35, 0) })
  page.drawText("Not a real government document. Shown only to demonstrate the app.", { x: 56, y: 752, size: 10, font })
  page.drawText(title, { x: 56, y: 690, size: 20, font: bold })
  lines.forEach((l, i) => page.drawText(l, { x: 56, y: 650 - i * 22, size: 12, font }))
  return pdf.save()
}

export async function resetDemo() {
  const sb = db()
  if (!sb) throw new Error("The demo needs the HERMIT database.")
  const id = DEMO_OWNER
  const profile = demoProfile()

  for (const table of ["documents", "vault_events", "chat_messages", "payments", "submissions"])
    await sb.from(table).delete().eq("owner_id", id)
  const { error } = await sb.from("owners").upsert({ id, profile, items: ITEMS, last_diff: null, egov_uniqid: null, updated_at: new Date().toISOString() })
  if (error) throw error

  // Vault: sample files, checked by the same rules as real uploads.
  const fullAddress = `${profile.businessAddress}, Brgy. ${profile.barangay}, ${profile.city}`
  const docs: VaultDoc[] = []
  for (const [i, [type, fileName, requirementId, number, issuedOn, expiresOn]] of DOCS.entries()) {
    const docId = `0de30000-0000-4000-9000-${String(i + 1).padStart(12, "0")}`
    const bytes = await samplePdf(NAMES[type] ?? fileName, [
      `Name: ${profile.ownerName}`,
      `Business: ${profile.businessName}`,
      `Address: ${fullAddress}`,
      number && `No.: ${number}`,
      issuedOn && `Issued: ${issuedOn}`,
      expiresOn && `Valid until: ${expiresOn}`,
    ].filter(Boolean) as string[])
    const storagePath = `${id}/${docId}`
    await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: "application/pdf", upsert: true })
    const base = {
      id: docId,
      fileName,
      mime: "application/pdf",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedAt: ago((DOCS.length - i) * 7 * 86_400_000),
      requirementId,
      expectedTypes: [type],
      extracted: { ...EMPTY_EXTRACTED, docType: type, ownerName: profile.ownerName, businessName: profile.businessName, address: fullAddress, number, tin: type === "bir_cor" ? profile.tin! : "", issuedOn, expiresOn, source: "ai" as const },
      ownerConfirmed: true,
      storagePath,
    }
    docs.push({ ...base, ...verifyDocument(base, profile, docs) })
  }
  await sb.from("documents").insert(
    docs.map((d) => ({
      id: d.id, owner_id: id, file_name: d.fileName, mime: d.mime, size: d.size, sha256: d.sha256, storage_path: d.storagePath, requirement_id: d.requirementId,
      expected_types: d.expectedTypes, extracted: d.extracted, checks: d.checks, verdict: d.verdict, owner_confirmed: d.ownerConfirmed, uploaded_at: d.uploadedAt,
    }))
  )
  await sb.from("vault_events").insert(docs.map((d) => ({ owner_id: id, doc_id: d.id, doc_name: d.fileName, event: d.verdict === "verified" ? "Na-upload at na-verify" : "Na-upload; kailangang suriin", at: d.uploadedAt })))

  // Last quarter's taxes: paid and filed. This quarter's 2551Q is still to pay.
  const paid = [
    { form_id: "bir_2551q", description: "BIR 2551Q · Quarterly percentage tax", period: `${year}-Q2`, amount: 5850, at: `${year}-07-22T10:14:00+08:00` },
    { form_id: "bir_1701q", description: "BIR 1701Q · Quarterly income tax (individuals)", period: `${year}-Q2`, amount: 3210, at: `${year}-08-13T15:40:00+08:00` },
  ]
  await sb.from("payments").insert(
    paid.map((p) => ({
      owner_id: id, txnid: `HRM-DEMO${p.form_id.slice(-5).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`, form_id: p.form_id, description: p.description, period: p.period,
      amount: p.amount, status: "paid", channel: "QR Ph (demo, no money moved)", refno: `DEMO-${randomBytes(4).toString("hex").toUpperCase()}`, paid_at: p.at, created_at: p.at, demo: true, tin: profile.tin, rdo_code: profile.rdoCode,
    }))
  )
  const ref = (kind: string) => `${kind}-SAMPLE-${randomBytes(3).toString("hex").toUpperCase()}`
  await sb.from("submissions").insert([
    { kind: "application", title: "Business name registration", agency: "DTI (BNRS)", requirement_id: "dti_bn", created_at: "2024-03-14T09:00:00+08:00" },
    { kind: "application", title: "Mayor's / Business Permit", agency: "City / municipal BPLO (e-BOSS)", requirement_id: "mayors_permit", created_at: `${year}-01-15T09:30:00+08:00` },
    { kind: "return", title: "BIR 2551Q · Quarterly percentage tax", agency: "Bureau of Internal Revenue", form_id: "bir_2551q", period: `${year}-Q2`, created_at: paid[0].at },
    { kind: "return", title: "BIR 1701Q · Quarterly income tax (individuals)", agency: "Bureau of Internal Revenue", form_id: "bir_1701q", period: `${year}-Q2`, created_at: paid[1].at },
    // In progress: filed moments ago, so they move while you watch.
    { kind: "application", title: "Fire Safety Inspection Certificate (FSIC)", agency: "BFP", requirement_id: "fsic", created_at: ago(90_000) },
    { kind: "application", title: "SSS employer registration", agency: "SSS", requirement_id: "sss_er", created_at: ago(25_000) },
  ].map((s) => ({ ...s, owner_id: id, ref_no: ref(s.kind === "return" ? "RTN" : "APP"), demo: true })))

  // A short earlier conversation with Kuya Hermit.
  const next = buildCalendar(profile, buildChecklist(profile, ITEMS), new Date(), 3)[0]
  await sb.from("chat_messages").insert([
    { owner_id: id, role: "owner", text: "Ano ang susunod kong babayaran?", at: ago(3_600_000) },
    {
      owner_id: id,
      role: "hermit",
      text: next
        ? `Ang susunod mong deadline ay ang ${next.title} (${next.form}), due sa ${next.due}. Buksan ang File & pay para kuwentahin, bayaran at i-file ito sa isang lugar.`
        : "Wala kang deadline sa susunod na 3 buwan.",
      at: ago(3_590_000),
    },
  ])
  return profile
}
