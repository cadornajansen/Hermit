"use server"

import { randomBytes } from "node:crypto"

import { BUCKET, db } from "@/lib/db"
import { getRequirement } from "@/lib/engine"
import { getPayable } from "@/lib/payments"
import { ownerId } from "@/lib/session"
import { newRefNo, type Submission, type SubmissionKind } from "@/lib/submissions"

// Filing a return or an application from HERMIT. Agencies aren't connected
// yet, so these are demo submissions (marked demo): the reference number and
// tracking show the flow; the owner still files with the agency for real.

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

type Row = {
  ref_no: string
  kind: SubmissionKind
  title: string
  agency: string
  form_id: string | null
  requirement_id: string | null
  period: string | null
  payment_txnid: string | null
  demo: boolean
  file_path: string | null
  created_at: string
}

const view = (r: Row): Submission => ({
  refNo: r.ref_no,
  kind: r.kind,
  title: r.title,
  agency: r.agency,
  formId: r.form_id,
  requirementId: r.requirement_id,
  period: r.period,
  paymentTxnid: r.payment_txnid,
  demo: r.demo,
  hasFile: Boolean(r.file_path),
  createdAt: r.created_at,
})

export async function submitFiling(input: { kind: SubmissionKind; formId?: string; requirementId?: string; period?: string; paymentTxnid?: string }) {
  const sb = db()
  if (!sb) return { ok: false as const, error: "Filing needs the HERMIT server." }
  const id = (await ownerId(true))!
  const kind = input?.kind === "return" ? "return" : "application"
  let title = ""
  let agency = ""
  if (kind === "return") {
    const p = getPayable(text(input.formId, 40))
    if (!p) return { ok: false as const, error: "Unknown return." }
    title = `BIR ${p.code} · ${p.label}`
    agency = "Bureau of Internal Revenue"
  } else {
    const r = getRequirement(text(input.requirementId, 60))
    if (!r) return { ok: false as const, error: "Unknown requirement." }
    title = r.name
    agency = r.agency
  }
  // A linked payment must be the owner's own, and paid.
  const txn = text(input.paymentTxnid, 60)
  if (txn) {
    const { data } = await sb.from("payments").select("status").eq("owner_id", id).eq("txnid", txn).maybeSingle()
    if (data?.status !== "paid") return { ok: false as const, error: "Pay first, then file." }
  }
  await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true })
  const row = {
    owner_id: id,
    ref_no: newRefNo(kind, randomBytes(3).toString("hex")),
    kind,
    title,
    agency,
    form_id: text(input.formId, 40) || null,
    requirement_id: text(input.requirementId, 60) || null,
    period: text(input.period, 10) || null,
    payment_txnid: txn || null,
    demo: true,
  }
  const { data, error } = await sb.from("submissions").insert(row).select().single()
  if (error) {
    console.error("submission insert failed", error)
    return { ok: false as const, error: "Hindi na-file. Subukan ulit." }
  }
  return { ok: true as const, submission: view(data as Row) }
}

export async function listSubmissions(): Promise<Submission[]> {
  const sb = db()
  const id = await ownerId()
  if (!sb || !id) return []
  const { data } = await sb.from("submissions").select("*").eq("owner_id", id).order("created_at", { ascending: false }).limit(50)
  return ((data ?? []) as Row[]).map(view)
}

// A short-lived link to the filled form attached to one of the owner's filings.
export async function submissionFile(refNo: string) {
  const sb = db()
  const id = await ownerId()
  if (!sb || !id) return null
  const { data } = await sb.from("submissions").select("file_path").eq("owner_id", id).eq("ref_no", text(refNo, 40)).maybeSingle()
  if (!data?.file_path) return null
  const signed = await sb.storage.from(BUCKET).createSignedUrl(data.file_path, 300)
  return signed.data?.signedUrl ?? null
}
