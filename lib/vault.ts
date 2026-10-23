// Document vault rules. The AI only *reads* a document (type, names, numbers,
// dates); whether it is the right, valid document for the owner is decided
// here, deterministically, so the result is explainable and testable.
import type { Check, DocType, Extracted, Profile, VaultDoc, Verdict } from "./types"

export const UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"]
export const UPLOAD_HELP = "Use PDF, PNG or JPEG. Convert WebP, HEIC and other images before uploading."

type DocInfo = {
  name: string
  hint: RegExp // filename / text hint, checked in this order
  expires: boolean
  hasOwnerName: boolean // personal name printed on it (not a company)
  formKey?: string // number gets remembered for form pre-fill under this key
}

export const DOC_TYPES: Record<DocType, DocInfo> = {
  bmbe_cert: { name: "BMBE Certificate of Authority", hint: /bmbe/i, expires: true, hasOwnerName: true },
  bir_cor: { name: "BIR Certificate of Registration (Form 2303)", hint: /2303|\bcor\b|\bbir\b/i, expires: false, hasOwnerName: true, formKey: "tin" },
  dti_cert: { name: "DTI Business Name Certificate", hint: /dti|bnrs|business.?name/i, expires: true, hasOwnerName: true, formKey: "dti_no" },
  sec_cert: { name: "SEC Certificate of Registration", hint: /\bsec\b|incorporat/i, expires: false, hasOwnerName: false, formKey: "dti_no" },
  cda_cert: { name: "CDA Certificate of Registration", hint: /\bcda\b|cooperative/i, expires: false, hasOwnerName: false, formKey: "dti_no" },
  mayors_permit: { name: "Mayor's / Business Permit", hint: /mayor|business.?permit|bplo/i, expires: true, hasOwnerName: true },
  brgy_clearance: { name: "Barangay Business Clearance", hint: /barangay|brgy|clearance/i, expires: true, hasOwnerName: true },
  fsic: { name: "Fire Safety Inspection Certificate", hint: /fsic|fire/i, expires: true, hasOwnerName: false },
  sanitary_permit: { name: "Sanitary Permit", hint: /sanitary/i, expires: true, hasOwnerName: false },
  health_cert: { name: "Health Certificate", hint: /\bhealth/i, expires: true, hasOwnerName: true },
  fda_lto: { name: "FDA License to Operate", hint: /\blto\b|fda|license.?to.?operate/i, expires: true, hasOwnerName: false },
  sss_er: { name: "SSS Employer Registration", hint: /\bsss\b/i, expires: false, hasOwnerName: false },
  philhealth_er: { name: "PhilHealth Employer Registration", hint: /philhealth|\ber1\b/i, expires: false, hasOwnerName: false },
  pagibig_er: { name: "Pag-IBIG Employer Registration", hint: /pag-?ibig|hdmf/i, expires: false, hasOwnerName: false },
  cedula: { name: "Community Tax Certificate (Cedula)", hint: /cedula|\bctc\b|community.?tax/i, expires: true, hasOwnerName: true },
  lease: { name: "Lease contract / land title / owner's consent", hint: /lease|kontrata|contract|title|tct|consent/i, expires: false, hasOwnerName: false },
  valid_id: { name: "Valid government ID", hint: /national.?id|philsys|umid|driver|passport|\bid\b/i, expires: true, hasOwnerName: true },
  other: { name: "Other document", hint: /$^/, expires: false, hasOwnerName: false },
}

export const docName = (t: DocType | "unknown") => (t === "unknown" ? "Unknown document" : DOC_TYPES[t].name)

export function guessDocType(text: string): DocType | "unknown" {
  const t = text.replace(/[_.\-]+/g, " ") // "bir_cor-2026.pdf" → "bir cor 2026 pdf"
  for (const [type, info] of Object.entries(DOC_TYPES)) if (info.hint.test(t)) return type as DocType
  return "unknown"
}

const REGISTRATION: DocType[] = ["dti_cert", "sec_cert", "cda_cert"]

// Per requirement: documents to bring (each slot = any one of these types)
// and the document the agency issues when it's done.
export const REQUIREMENT_DOCS: Record<string, { needs: DocType[][]; issues?: DocType }> = {
  dti_bn: { needs: [["valid_id"]], issues: "dti_cert" },
  sec_reg: { needs: [], issues: "sec_cert" },
  cda_reg: { needs: [], issues: "cda_cert" },
  brgy_clearance: { needs: [REGISTRATION, ["lease"], ["cedula"], ["valid_id"]], issues: "brgy_clearance" },
  mayors_permit: { needs: [REGISTRATION, ["brgy_clearance"], ["lease"], ["cedula"]], issues: "mayors_permit" },
  fsic: { needs: [], issues: "fsic" },
  sanitary_permit: { needs: [["health_cert"]], issues: "sanitary_permit" },
  health_certs: { needs: [], issues: "health_cert" },
  bir_cor: { needs: [REGISTRATION, ["valid_id"]], issues: "bir_cor" },
  bmbe: { needs: [REGISTRATION], issues: "bmbe_cert" },
  fda_lto: { needs: [["mayors_permit"]], issues: "fda_lto" },
  sss_er: { needs: [["mayors_permit"]], issues: "sss_er" },
  philhealth_er: { needs: [["mayors_permit"]], issues: "philhealth_er" },
  pagibig_er: { needs: [["mayors_permit"]], issues: "pagibig_er" },
  brgy_renewal: { needs: [["cedula"]], issues: "brgy_clearance" },
  mayors_renewal: { needs: [["brgy_clearance"], ["cedula"]], issues: "mayors_permit" },
}

// ---------------------------------------------------------------------------
// Matching helpers

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["jr", "sr", "ii", "iii"].includes(t))

// Order-insensitive; middle initials ignored ("DELA CRUZ, JUANA S." = "Juana Santos Dela Cruz").
export function namesMatch(a: string, b: string) {
  const [x, y] = [tokens(a), tokens(b)].sort((p, q) => p.length - q.length)
  return x.length > 0 && x.every((t) => y.includes(t))
}

const DAY = 86_400_000
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

// ---------------------------------------------------------------------------
// Verification

export function verifyDocument(
  doc: Pick<VaultDoc, "id" | "sha256" | "expectedTypes" | "extracted" | "ownerConfirmed">,
  profile: Profile,
  others: VaultDoc[],
  today = new Date()
): { checks: Check[]; verdict: Verdict } {
  const e = doc.extracted
  const checks: Check[] = []
  const add = (id: string, label: string, result: Check["result"], detail: string) =>
    checks.push({ id, label, result, detail })

  // 1. Is it the document they meant to submit?
  const expected = doc.expectedTypes
  if (e.docType === "unknown") {
    add("type", "Uri ng dokumento", "warn", "Hindi matukoy kung anong dokumento ito. I-edit ang detalye para piliin.")
  } else if (expected.length && !expected.includes(e.docType)) {
    add("type", "Uri ng dokumento", "fail", `Mukhang ${docName(e.docType)} ito, pero ${expected.map(docName).join(" o ")} ang kailangan.`)
  } else {
    add("type", "Uri ng dokumento", "pass", docName(e.docType))
  }
  const info = e.docType === "unknown" ? null : DOC_TYPES[e.docType]

  // 2. Same file uploaded before?
  const dup = others.find((o) => o.id !== doc.id && o.sha256 === doc.sha256)
  if (dup) add("duplicate", "Duplicate", "warn", "Na-upload mo na ang file na ito dati.")

  // 3. Owner name must match across every document (agencies reject mismatches).
  if (info?.hasOwnerName) {
    if (!e.ownerName) add("owner", "Pangalan ng may-ari", "warn", "Hindi nabasa ang pangalan sa dokumento.")
    else if (!profile.ownerName) add("owner", "Pangalan ng may-ari", "warn", "Wala pang pangalan sa profile mo para ikumpara.")
    else if (namesMatch(e.ownerName, profile.ownerName)) add("owner", "Pangalan ng may-ari", "pass", e.ownerName)
    else
      add("owner", "Pangalan ng may-ari", "fail", `"${e.ownerName}" ang nasa dokumento, pero "${profile.ownerName}" ang nasa profile. Dapat pareho sa DTI, BIR at permits.`)
  }

  // 4. Business name: against the profile and every other document on file.
  if (e.businessName) {
    if (profile.businessName && !namesMatch(e.businessName, profile.businessName)) {
      add("business", "Pangalan ng negosyo", "fail", `"${e.businessName}" ang nasa dokumento, pero "${profile.businessName}" ang nasa profile.`)
    } else {
      const clash = others.find(
        (o) => o.id !== doc.id && o.verdict !== "rejected" && o.extracted.businessName && !namesMatch(o.extracted.businessName, e.businessName)
      )
      if (clash)
        add("business", "Pangalan ng negosyo", "warn", `Iba ang nasa ${docName(clash.extracted.docType)}: "${clash.extracted.businessName}". Ayusin para hindi ma-reject.`)
      else add("business", "Pangalan ng negosyo", "pass", e.businessName)
    }
  }

  // 5. Still valid?
  if (e.expiresOn) {
    const days = Math.floor((Date.parse(e.expiresOn) - today.getTime()) / DAY)
    if (!validDate(e.expiresOn)) add("expiry", "Validity", "warn", `Hindi mabasa ang expiry date "${e.expiresOn}".`)
    else if (days < 0) add("expiry", "Validity", "fail", `Expired noong ${e.expiresOn}. Kailangang i-renew.`)
    else if (days <= 30) add("expiry", "Validity", "warn", `Mag-e-expire sa ${e.expiresOn} (${days} araw na lang).`)
    else add("expiry", "Validity", "pass", `Valid hanggang ${e.expiresOn}`)
  } else if (info?.expires) {
    add("expiry", "Validity", "warn", "Walang nabasang expiry date. I-type ito para maalala ni Hermit ang renewal.")
  }

  // 6. Issued by the LGU where the business is?
  if (e.address && profile.city && !tokens(e.address).some((t) => tokens(profile.city).includes(t))) {
    add("city", "Lugar", "warn", `Hindi ${profile.city} ang address sa dokumento. Tama ba ang lungsod?`)
  }

  // Minimum readable identity evidence; a type guess or confirmation is insufficient.
  const missing: string[] = []
  if (!info || e.docType === "other") missing.push("supported document type")
  else {
    if (!e.ownerName.trim() && !e.businessName.trim()) missing.push("owner or business name")
    if (!["valid_id", "health_cert", "cedula", "lease"].includes(e.docType) && !e.businessName.trim()) missing.push("business name")
    if (e.docType === "lease") {
      if (!e.address.trim()) missing.push("property address")
    } else if (!(e.docType === "bir_cor" ? e.tin : e.number).trim()) missing.push(e.docType === "bir_cor" ? "TIN" : "document number")
    if (e.docType !== "valid_id" && (!validDate(e.issuedOn) || e.issuedOn > today.toISOString().slice(0, 10))) missing.push("valid issue date (not in the future)")
  }
  add("evidence", "Document evidence", missing.length ? "warn" : "pass", missing.length ? `Missing: ${missing.join(", ")}. Confirmation cannot supply missing evidence.` : "Minimum identity details present; application completion and official issuance are not verified.")

  const verdict: Verdict = checks.some((c) => c.result === "fail")
    ? "rejected"
    : checks.some((c) => c.result === "warn")
      ? "needs_review"
      : "verified"
  return { checks, verdict }
}

// ---------------------------------------------------------------------------
// Coverage: which documents each requirement still needs.

const RANK: Record<Verdict, number> = { verified: 0, needs_review: 1, rejected: 2 }

export type SlotStatus = { types: DocType[]; doc?: VaultDoc }

function best(docs: VaultDoc[], types: DocType[]) {
  return docs
    // A file rejected for being the wrong document type doesn't count for any slot.
    .filter((d) => d.extracted.docType !== "unknown" && types.includes(d.extracted.docType))
    .filter((d) => d.checks.find((c) => c.id === "type")?.result !== "fail")
    .sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || b.uploadedAt.localeCompare(a.uploadedAt))[0]
}

export function coverage(requirementId: string, docs: VaultDoc[]) {
  const spec = REQUIREMENT_DOCS[requirementId]
  if (!spec) return null
  return {
    needs: spec.needs.map((types): SlotStatus => ({ types, doc: best(docs, types) })),
    issued: spec.issues ? ({ types: [spec.issues], doc: best(docs, [spec.issues]) } as SlotStatus) : undefined,
  }
}

export const EMPTY_EXTRACTED: Extracted = {
  docType: "unknown",
  ownerName: "",
  businessName: "",
  address: "",
  number: "",
  tin: "",
  issuedOn: "",
  expiresOn: "",
  source: "filename",
}
