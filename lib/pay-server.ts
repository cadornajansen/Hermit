import "server-only"

import { db } from "@/lib/db"
import { egov } from "@/lib/egov"

export type PaymentRow = {
  id: string
  owner_id: string
  txnid: string
  gateway_uuid: string | null
  payment_url: string | null
  form_id: string
  description: string
  tin: string | null
  rdo_code: string | null
  atc: string | null
  period: string | null
  amount: string
  status: "pending" | "paid" | "failed" | "expired"
  channel: string | null
  refno: string | null
  paid_at: string | null
  created_at: string
  demo: boolean
}

// Re-reads a pending payment from eGovPay and saves what it says. Used by the
// status poll and the gateway callback; neither trusts what the browser or the
// callback body claims.
export async function refreshPayment(row: PaymentRow): Promise<PaymentRow> {
  const sb = db()
  if (!sb || row.status !== "pending" || !row.gateway_uuid) return row
  try {
    const t = await egov("pay").getTransaction(row.gateway_uuid)
    const status: PaymentRow["status"] = t.paid
      ? "paid"
      : /expired/i.test(t.status)
        ? "expired"
        : /fail|cancel|void|declin/i.test(t.status)
          ? "failed"
          : "pending"
    if (status === row.status && !t.refno) return row
    const patch = { status, channel: t.channel, refno: t.refno || row.refno, paid_at: t.paidAt, updated_at: new Date().toISOString() }
    await sb.from("payments").update(patch).eq("id", row.id)
    return { ...row, ...patch }
  } catch (e) {
    console.error("eGovPay status check failed", e)
    return row
  }
}
