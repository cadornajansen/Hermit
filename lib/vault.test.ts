// Run: pnpm test
import assert from "node:assert/strict"
import { test } from "node:test"

import type { Profile, VaultDoc } from "./types"
import { EMPTY_PROFILE } from "./engine.ts"
import { coverage, EMPTY_EXTRACTED, guessDocType, namesMatch, verifyDocument } from "./vault.ts"

const owner: Profile = { ...EMPTY_PROFILE, ownerName: "Juana Santos Dela Cruz", businessName: "Nena's Carinderia", city: "Taguig" }
const today = new Date("2026-10-22")
const doc = (over: Partial<Omit<VaultDoc, "extracted">> & { extracted?: Partial<VaultDoc["extracted"]> } = {}): VaultDoc => ({
  id: "d1",
  fileName: "f.pdf",
  mime: "application/pdf",
  size: 1,
  sha256: "aaa",
  uploadedAt: "2026-10-22T00:00:00Z",
  expectedTypes: [],
  checks: [],
  verdict: "verified",
  ownerConfirmed: false,
  ...over,
  extracted: { ...EMPTY_EXTRACTED, ...over.extracted },
})
const verify = (d: VaultDoc, others: VaultDoc[] = []) => verifyDocument(d, owner, others, today)

test("names match regardless of order, case and middle initials", () => {
  assert.ok(namesMatch("DELA CRUZ, JUANA S.", "Juana Santos Dela Cruz"))
  assert.ok(!namesMatch("Juan Dela Cruz", "Juana Santos Dela Cruz"))
})

test("filename hints pick the document type", () => {
  assert.equal(guessDocType("bir_cor-2026.pdf"), "bir_cor")
  assert.equal(guessDocType("philhealth-er1.jpg"), "philhealth_er")
  assert.equal(guessDocType("health_card_ana.jpg"), "health_cert")
  assert.equal(guessDocType("IMG_2041.jpg"), "unknown")
})

test("a correct, valid permit is verified", () => {
  const d = doc({ extracted: { docType: "mayors_permit", ownerName: "JUANA S. DELA CRUZ", businessName: "NENA'S CARINDERIA", address: "Western Bicutan, Taguig City", expiresOn: "2026-12-31" } })
  assert.equal(verify(d).verdict, "verified")
})

test("wrong document for the slot is rejected", () => {
  const d = doc({ expectedTypes: ["dti_cert"], extracted: { docType: "cedula", ownerName: "Juana Dela Cruz", expiresOn: "2026-12-31" } })
  const r = verify(d)
  assert.equal(r.verdict, "rejected")
  assert.equal(r.checks.find((c) => c.id === "type")?.result, "fail")
})

test("owner name mismatch and expired documents are rejected", () => {
  assert.equal(verify(doc({ extracted: { docType: "cedula", ownerName: "Pedro Penduko", expiresOn: "2026-12-31" } })).verdict, "rejected")
  assert.equal(verify(doc({ extracted: { docType: "cedula", ownerName: "Juana Dela Cruz", expiresOn: "2025-12-31" } })).verdict, "rejected")
})

test("missing details need review until the owner confirms", () => {
  const d = doc({ extracted: { docType: "mayors_permit" } })
  assert.equal(verify(d).verdict, "needs_review")
  assert.equal(verify({ ...d, ownerConfirmed: true }).verdict, "verified")
})

test("business name clash across documents is flagged", () => {
  const dti = doc({ id: "dti", extracted: { docType: "dti_cert", businessName: "Nena's Eatery" } })
  const cor = doc({ id: "cor", extracted: { docType: "bir_cor", ownerName: "Juana Dela Cruz", businessName: "Nena's Carinderia", tin: "123" } })
  const profileless = { ...owner, businessName: "" }
  const r = verifyDocument(cor, profileless, [dti], today)
  assert.equal(r.checks.find((c) => c.id === "business")?.result, "warn")
})

test("coverage picks the best document per slot", () => {
  const bad = doc({ id: "a", verdict: "rejected", extracted: { docType: "cedula" } })
  const good = doc({ id: "b", verdict: "verified", extracted: { docType: "cedula" } })
  const c = coverage("mayors_permit", [bad, good])!
  assert.equal(c.needs.find((s) => s.types.includes("cedula"))?.doc?.id, "b")
  assert.equal(c.issued?.doc, undefined)
})
