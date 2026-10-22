import { db } from "@/lib/db"
import { refreshPayment, type PaymentRow } from "@/lib/pay-server"

// eGovPay notifies here when a payment changes. The body is only used to find
// the payment; its status is always re-read from eGovPay itself.
async function handle(request: Request) {
  const url = new URL(request.url)
  let body: Record<string, unknown> = {}
  try {
    body = request.method === "POST" ? await request.clone().json() : {}
  } catch {
    try {
      body = Object.fromEntries((await request.formData()).entries())
    } catch {}
  }
  const pick = (k: string) => String(body[k] ?? (body.data as Record<string, unknown> | undefined)?.[k] ?? url.searchParams.get(k) ?? "")
  const txnid = pick("txnid")
  const uuid = pick("uuid")
  const sb = db()
  if (!sb || (!/^HRM-[A-Z0-9-]{6,40}$/.test(txnid) && !uuid)) return Response.json({ ok: false }, { status: 400 })
  const q = sb.from("payments").select("*")
  const { data } = await (txnid ? q.eq("txnid", txnid) : q.eq("gateway_uuid", uuid.slice(0, 80))).maybeSingle()
  if (!data) return Response.json({ ok: false }, { status: 404 })
  const row = await refreshPayment(data as PaymentRow)
  return Response.json({ ok: true, status: row.status })
}

export const POST = handle
export const GET = handle
