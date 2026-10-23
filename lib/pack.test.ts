import assert from "node:assert/strict"
import { test } from "node:test"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { extractText } from "unpdf"
import { createCanvas } from "@napi-rs/canvas"

import { loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"
import { formsFor } from "./forms.ts"
import { EMPTY_EXTRACTED } from "./vault.ts"
import type { VaultDoc } from "./types.ts"

const profile = { ...EMPTY_PROFILE, ownerName: "Alex Taylor Rivera", businessName: "Synthetic Shop", structure: "sole" as const, premises: "owned" as const, lang: "en" as const }
const { packetPlan, buildPacket } = await loadRuntime("lib/pack.ts")
async function textOf(bytes: Uint8Array) {
  return (await extractText(bytes.slice(), { mergePages: true })).text
}
async function officialPdf() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage().drawText("SYNTHETIC OFFICIAL PAGE", { x: 50, y: 400, font })
  return pdf.save()
}
function document(type: VaultDoc["extracted"]["docType"], verdict: VaultDoc["verdict"] = "verified"): VaultDoc {
  return { id: "fixture", fileName: "synthetic", mime: "application/pdf", size: 1, sha256: "fixture", uploadedAt: "2026-10-23", expectedTypes: [], extracted: { ...EMPTY_EXTRACTED, docType: type }, checks: [], verdict, ownerConfirmed: false }
}

test("packet selects forms for the filing task and entity and records inclusion reasons", () => {
  const plan = packetPlan("bir_cor", profile, [])
  assert.deepEqual(plan.forms.map((f: { form: { id: string } }) => f.form.id), ["bir_1901"])
  assert.match(plan.forms[0].reason, /new:.*Register/)
  assert.deepEqual(formsFor("bir_cor", profile, "update").map((f) => f.id), ["bir_1905"])
  assert.deepEqual(formsFor("bir_cor", profile, "abatement").map((f) => f.id), ["bir_2121"])
  assert.deepEqual(formsFor("bir_cor", { ...profile, structure: "corporation" }).map((f) => f.id), ["pbh", "bir_1903"])
  assert.deepEqual(formsFor("dti_bn", profile, "renewal").map((f) => f.id), ["dti_bn_renewal"])
})

test("cover and body share a single prepared official PDF or an explained fallback", async (t) => {
  const source = await officialPdf()
  for (const success of [false, true]) {
    let calls = 0
    t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(success ? source.slice().buffer : "unavailable", { status: success ? 200 : 503 }) })
    const plan = packetPlan("bir_cor", profile, [])
    plan.forms[0].file = { url: "https://synthetic.invalid/form.pdf", path: "synthetic.pdf" }
    plan.forms[0].layout = { formId: "bir_1901", sha256: "synthetic", fillable: false, pages: [], entries: [{ key: "owner_name", page: 0, x: 50, y: 300, size: 10 }] }
    const bytes = await buildPacket(plan, profile, async () => undefined)
    const text = await textOf(bytes)
    assert.equal(calls, 1)
    assert.match(text, /Alex Taylor Rivera/)
    if (success) {
      assert.match(text, /official form, filled in/)
      assert.match(text, /SYNTHETIC OFFICIAL PAGE/)
      assert.doesNotMatch(text, /info sheet: copy/)
    } else {
      assert.match(text, /info sheet: copy/)
      assert.match(text, /HTTP 503/)
      assert.match(text, /Copy these answers onto/)
      assert.doesNotMatch(text, /official form, filled in|SYNTHETIC OFFICIAL PAGE/)
    }
    t.mock.restoreAll()
  }
})

test("attachments report actual PDF/PNG/JPEG outcomes and explicitly omit WebP and broken files", async () => {
  const canvas = createCanvas(2, 2)
  const pdf = await officialPdf()
  const cases: [string, Uint8Array, boolean][] = [
    ["application/pdf", pdf, true], ["image/png", canvas.toBuffer("image/png"), true],
    ["image/jpeg", canvas.toBuffer("image/jpeg"), true], ["image/webp", canvas.toBuffer("image/webp"), false],
    ["image/png", new Uint8Array([1, 2, 3]), false], ["application/pdf", new Uint8Array([1, 2, 3]), false],
  ]
  for (const [mime, data, included] of cases) {
    const plan = packetPlan("dti_bn", profile, [document("valid_id")])
    plan.forms = []
    const bytes = await buildPacket(plan, profile, async () => new Blob([data.slice().buffer as ArrayBuffer], { type: mime }))
    const text = await textOf(bytes)
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), included ? 2 : 1, mime)
    if (included) { assert.match(text, /Vault copy: Valid government ID/); assert.doesNotMatch(text, /omitted/) }
    else { assert.match(text, /Unavailable \/ omitted: Valid government ID/); assert.doesNotMatch(text, /Vault copy:/) }
    if (mime === "image/webp") assert.match(text, /unsupported file type image\/webp/)
  }
})

test("fetch failures and review/rejected states never count as packet attachments", async () => {
  for (const verdict of ["verified", "needs_review", "rejected"] as const) {
    let fetched = 0
    const plan = packetPlan("dti_bn", profile, [document("valid_id", verdict)])
    plan.forms = []
    const bytes = await buildPacket(plan, profile, async () => { fetched++; throw new Error("HTTP 503") })
    const text = await textOf(bytes)
    assert.equal(fetched, verdict === "verified" ? 1 : 0)
    assert.match(text, verdict === "verified" ? /HTTP 503/ : verdict === "needs_review" ? /awaiting review/ : /rejected/)
    assert.doesNotMatch(text, /Vault copy:|\[x\]/)
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
  }
})
