"use server"

import { randomBytes } from "node:crypto"
import { headers } from "next/headers"

import { db } from "@/lib/db"
import { egov, isLive } from "@/lib/egov"
import { refreshPayment, type PaymentRow } from "@/lib/pay-server"
import { SERVICES, type ServiceId } from "@/lib/agencies"
import { getPayable, parseAmount, periodsFor } from "@/lib/payments"
import { ownerId } from "@/lib/session"

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

// Public view of a payment row (no owner id).
const view = (r: PaymentRow) => ({
  txnid: r.txnid,
  description: r.description,
  formId: r.form_id,
  period: r.period,
  amount: Number(r.amount),
  status: r.status,
  channel: r.channel,
  refno: r.refno,
  paidAt: r.paid_at,
  createdAt: r.created_at,
  paymentUrl: r.status === "pending" ? r.payment_url : null,
})
export type PaymentView = ReturnType<typeof view>

export async function paymentsAvailable() {
  return isLive("pay") && Boolean(db())
}

export async function startTaxPayment(input: {
  formId: string
  period: string
  amount: string
  tin: string
  rdoCode?: string
  atc?: string
  name: string
  email?: string
  mobile?: string
}) {
  const payable = getPayable(text(input?.formId, 40))
  const amount = parseAmount(text(input?.amount, 20))
  const period = text(input?.period, 10)
  const tin = text(input?.tin, 20).replace(/\D/g, "")
  const rdo = text(input?.rdoCode, 4).toUpperCase()
  const atc = text(input?.atc, 8).toUpperCase()
  const name = text(input?.name, 120)
  if (!payable) return { ok: false as const, error: "Piliin kung ano ang babayaran." }
  if (!periodsFor(payable.period).some((p) => p.value === period)) return { ok: false as const, error: "Piliin ang tamang return period." }
  if (!amount) return { ok: false as const, error: "Ilagay ang halaga mula sa return mo (hal. 1,250.00)." }
  if (tin.length < 9 || tin.length > 14) return { ok: false as const, error: "Ilagay ang TIN mo (9 hanggang 14 na numero)." }
  if (rdo && !/^\d{3}[A-Z]?$/.test(rdo)) return { ok: false as const, error: "Ang RDO code ay 3 numero (hal. 044)." }
  if (atc && !/^[A-Z]{2}\d{3}[A-Z]?$/.test(atc)) return { ok: false as const, error: "Ang ATC ay parang PT010 o WC010." }
  if (!name) return { ok: false as const, error: "Ilagay ang pangalan ng taxpayer." }

  const sb = db()
  if (!isLive("pay") || !sb) return { ok: false as const, error: "not_connected" }

  const id = (await ownerId(true))!
  await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true })
  const txnid = `HRM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`
  const description = `BIR ${payable.code} · ${payable.label}`
  const { error: insertError } = await sb.from("payments").insert({
    owner_id: id, txnid, form_id: payable.formId, description, tin, rdo_code: rdo || null, atc: atc || null, period, amount,
  })
  if (insertError) {
    console.error("payments insert failed", insertError)
    return { ok: false as const, error: "Hindi masimulan ang bayad. Subukan ulit." }
  }

  const h = await headers()
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  try {
    const p = await egov("pay").createPayment({
      txnid,
      amount,
      items: [{ name: `${description} (${period})`, amount }],
      callbackUrl: `${origin}/api/pay/callback`,
      redirectUrl: `${origin}/pay?txn=${txnid}`,
    })
    await sb.from("payments").update({ gateway_uuid: p.uuid, payment_url: p.url }).eq("txnid", txnid)
    return { ok: true as const, txnid, url: p.url }
  } catch (e) {
    console.error("eGovPay create failed", e)
    await sb.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("txnid", txnid)
    return { ok: false as const, error: "Hindi ma-reach ang payment gateway ngayon. Subukan ulit mamaya." }
  }
}

// Government service fees started from Kuya Hermit (e.g. NBI clearance).
// The amount comes from the server's catalog, never from the browser.
export async function startServicePayment(input: { service: string; purpose: string }) {
  const id_ = text(input?.service, 40) as ServiceId
  const svc = SERVICES[id_]
  if (!svc) return { ok: false as const, error: "Unknown service" }
  const purpose = text(input?.purpose, 80) || "General"
  const sb = db()
  if (!isLive("pay") || !sb) return { ok: false as const, error: "not_connected" }

  const id = (await ownerId(true))!
  await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true })
  const txnid = `HRM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`
  const amount = svc.fee + svc.eFee
  const description = `${svc.name} · ${purpose}`
  const { error: insertError } = await sb.from("payments").insert({ owner_id: id, txnid, form_id: id_, description, period: null, amount })
  if (insertError) {
    console.error("payments insert failed", insertError)
    return { ok: false as const, error: "Hindi masimulan ang bayad. Subukan ulit." }
  }
  const h = await headers()
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  try {
    const p = await egov("pay").createPayment({
      txnid,
      amount,
      items: [
        { name: `${svc.name} fee`, amount: svc.fee },
        { name: "e-payment fee", amount: svc.eFee },
      ],
      callbackUrl: `${origin}/api/pay/callback`,
      redirectUrl: `${origin}/pay?txn=${txnid}`,
    })
    await sb.from("payments").update({ gateway_uuid: p.uuid, payment_url: p.url }).eq("txnid", txnid)
    return { ok: true as const, txnid, url: p.url, amount }
  } catch (e) {
    console.error("eGovPay create failed", e)
    await sb.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("txnid", txnid)
    return { ok: false as const, error: "Hindi ma-reach ang payment gateway ngayon. Subukan ulit mamaya." }
  }
}

async function ownRow(txnid: string) {
  const sb = db()
  const id = await ownerId()
  if (!sb || !id || !/^HRM-[A-Z0-9-]{6,40}$/.test(txnid)) return null
  const { data } = await sb.from("payments").select("*").eq("owner_id", id).eq("txnid", txnid).maybeSingle()
  return data as PaymentRow | null
}

export async function paymentStatus(txnid: string) {
  const row = await ownRow(text(txnid, 60))
  return row ? view(await refreshPayment(row)) : null
}

export async function listPayments() {
  const sb = db()
  const id = await ownerId()
  if (!sb || !id) return []
  const { data } = await sb.from("payments").select("*").eq("owner_id", id).order("created_at", { ascending: false }).limit(30)
  return ((data ?? []) as PaymentRow[]).map(view)
}
