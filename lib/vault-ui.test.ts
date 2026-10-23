import assert from "node:assert/strict"
import { test } from "node:test"
import type { ReactElement, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { dataModule, loadRuntime } from "../test-support/runtime.mjs"
import { EMPTY_PROFILE } from "./engine.ts"
import { EMPTY_EXTRACTED, UPLOAD_TYPES } from "./vault.ts"
import type { VaultDoc } from "./types.ts"

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== "object") return []
  if (Array.isArray(node)) return node.flatMap(elements)
  const element = node as ReactElement<Record<string, unknown>>
  return [element, ...elements(element.props?.children as ReactNode)]
}

test("confirmation retains review and never approves a completion-dependent checklist item", async () => {
  const profile = { ...EMPTY_PROFILE, ownerName: "Alex Rivera", businessName: "Synthetic Shop", structure: "sole" as const }
  const document: VaultDoc = { id: "synthetic", fileName: "synthetic.pdf", mime: "application/pdf", size: 1, sha256: "synthetic", uploadedAt: "2026-10-23", requirementId: "mayors_permit", expectedTypes: ["mayors_permit"], extracted: { ...EMPTY_EXTRACTED, docType: "mayors_permit" }, checks: [], verdict: "needs_review", ownerConfirmed: false }
  const fixture = { editing: false, state: { profile, docs: [document], items: { mayors_permit: { status: "in_progress" } }, vaultLog: [] } }
  Object.assign(globalThis, { __hermitVaultUi: fixture })
  const vault = await loadRuntime("components/vault.tsx", {
    react: dataModule("export const useState=v=>[v===false&&globalThis.__hermitVaultUi.editing?true:v,()=>{}];export const useRef=v=>({current:v});export const useTransition=()=>[false,fn=>fn()];"),
    "@/app/actions": dataModule("export const readDocument=async()=>{throw Error('unexpected service call')};"),
    "@/app/sync": dataModule("export const documentUrl=async()=>null;"),
    "@/lib/files": dataModule("export const deleteFile=async()=>{};export const getFile=async()=>{};export const putFile=async()=>{};export const sha256=async()=>'';"),
    "@/lib/store": dataModule("const f=globalThis.__hermitVaultUi;export const useProfile=()=>f.state;export const update=fn=>{f.state={...f.state,...fn(f.state)}};"),
    "@/components/ui/button": dataModule("export const Button=({children})=>children;"),
  })
  const tree = vault.Vault({ initialRequirement: "", initialType: "" })
  const card = elements(tree).find((element) => typeof element.type === "function" && element.type.name === "DocCard")!
  assert.ok(card)
  const renderCard = () => (card.type as (props: unknown) => ReactNode)({ ...card.props, doc: fixture.state.docs[0] })
  const confirm = elements(renderCard()).find((element) => element.props.children === "Tama ito")!
  ;(confirm.props.onClick as () => void)()
  assert.equal(fixture.state.docs[0].ownerConfirmed, true)
  assert.equal(fixture.state.docs[0].verdict, "needs_review")
  assert.equal(fixture.state.items.mayors_permit.status, "in_progress")
  assert.match(renderToStaticMarkup(renderCard()), /Application completion \/ official issuance: unverified/)
  const populated = { ...fixture.state.docs[0], extracted: { ...document.extracted, ownerName: profile.ownerName, businessName: profile.businessName, number: "SYNTHETIC", issuedOn: "2026-01-01", expiresOn: "2030-12-31" } }
  fixture.state.docs[0] = populated
  const confirmPopulated = elements(renderCard()).find((element) => element.props.children === "Tama ito")!
  ;(confirmPopulated.props.onClick as () => void)()
  assert.equal(fixture.state.docs[0].verdict, "verified")
  assert.equal(fixture.state.items.mayors_permit.status, "in_progress")
  assert.deepEqual(UPLOAD_TYPES, ["application/pdf", "image/jpeg", "image/png"])

  // Submit actual edit logic with a synthetic FormData boundary (no browser required).
  const original = { ...fixture.state.docs[0].extracted }
  fixture.editing = true
  const form = elements(renderCard()).find((element) => element.type === "form")!
  const input = new FormData()
  for (const [key, value] of Object.entries(original)) if (typeof value === "string") input.set(key, value)
  input.set("number", "SYNTHETIC-CORRECTED")
  const constructor = globalThis.FormData
  try {
    Object.defineProperty(globalThis, "FormData", { value: function () { return input }, configurable: true, writable: true })
    ;(form.props.onSubmit as (event: unknown) => void)({ preventDefault() {}, currentTarget: {} })
  } finally { globalThis.FormData = constructor }
  const corrected = fixture.state.docs[0]
  assert.deepEqual(corrected.extracted.original, original)
  assert.equal(corrected.extracted.corrections!.number, "SYNTHETIC-CORRECTED")
  assert.equal(corrected.ownerConfirmed, false)
  assert.equal(corrected.verdict, "verified")
  assert.equal(fixture.state.items.mayors_permit.status, "in_progress")
})
