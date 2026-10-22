"use client"

import { CheckCircle2, CreditCard, ExternalLink, Landmark, Lock, Printer, QrCode, ShieldCheck, Smartphone, Wallet } from "lucide-react"
import Link from "next/link"
import QRCode from "qrcode"
import { useEffect, useState, useTransition } from "react"

import { listPayments, paymentStatus, startTaxPayment, type PaymentView } from "@/app/pay"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildCalendar, buildChecklist } from "@/lib/engine"
import { getPayable, parseAmount, PAYABLES, periodsFor, peso, type Payable } from "@/lib/payments"
import { useProfile } from "@/lib/store"
import { cn } from "@/lib/utils"

const input = "h-11 w-full rounded-xl border bg-background px-3 text-base"

const STATUS: Record<PaymentView["status"], { label: string; tone: string }> = {
  pending: { label: "Hinihintay", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  paid: { label: "Bayad na", tone: "bg-primary/15 text-primary" },
  failed: { label: "Hindi natuloy", tone: "bg-destructive/15 text-destructive" },
  expired: { label: "Nag-expire", tone: "bg-muted text-muted-foreground" },
}

export function PayTerminal({ initialForm, returnTxn }: { initialForm: string; returnTxn: string }) {
  const { profile, items } = useProfile()
  const [formId, setFormId] = useState(getPayable(initialForm) ? initialForm : "")
  const payable = getPayable(formId)
  const [period, setPeriod] = useState(() => (payable ? periodsFor(payable.period)[0].value : ""))
  const [amount, setAmount] = useState("")
  const [atc, setAtc] = useState("")
  const [error, setError] = useState<string>()
  const [notConnected, setNotConnected] = useState(false)
  const [active, setActive] = useState<{ txnid: string; url: string } | null>(null)
  const [status, setStatus] = useState<PaymentView | null>(null)
  const [history, setHistory] = useState<PaymentView[]>([])
  const [pending, start] = useTransition()

  useEffect(() => {
    listPayments().then(setHistory).catch(() => {})
  }, [status?.status])

  // Back from the gateway (?txn=…) or waiting on a QR payment: poll eGovPay via the server.
  const watching = returnTxn || active?.txnid
  useEffect(() => {
    if (!watching) return
    let stop = false
    const tick = async () => {
      const s = await paymentStatus(watching).catch(() => null)
      if (stop) return
      if (s) setStatus(s)
      if (!s || s.status === "pending") setTimeout(tick, 5000)
    }
    tick()
    return () => {
      stop = true
    }
  }, [watching])

  if (!profile) return null

  const due = new Map(
    buildCalendar(profile, buildChecklist(profile, items), new Date(), 3).map((d) => [d.id.split(":")[0], d.due] as const)
  )
  const offered = [...PAYABLES].sort((a, b) => Number(due.has(b.deadlineId ?? "")) - Number(due.has(a.deadlineId ?? "")))
  const periods = payable ? periodsFor(payable.period) : []
  const value = parseAmount(amount)
  const tin = profile.extra.tin ?? ""
  const rdo = profile.extra.rdo_code ?? ""

  function choose(p: Payable) {
    setFormId(p.formId)
    setPeriod(periodsFor(p.period)[0].value)
    setError(undefined)
    setNotConnected(false)
  }

  function pay() {
    setError(undefined)
    start(async () => {
      const r = await startTaxPayment({
        formId,
        period,
        amount,
        tin,
        rdoCode: rdo,
        atc,
        name: profile!.businessName || profile!.ownerName,
        email: profile!.email,
        mobile: profile!.mobile,
      })
      if (r.ok) {
        setActive({ txnid: r.txnid, url: r.url })
        setStatus(null)
      } else if (r.error === "not_connected") setNotConnected(true)
      else setError(r.error)
    })
  }

  // ---- Receipt / waiting on the gateway --------------------------------------
  if (status?.status === "paid") return <Receipt p={status} />
  if (active || (returnTxn && status)) {
    return (
      <div className="flex flex-col gap-4">
        <Header />
        {active && <ScanToPay url={active.url} />}
        {status && status.status !== "pending" && (
          <p className={cn("rounded-xl p-3 text-sm", STATUS[status.status].tone)}>
            {status.status === "failed" ? "Hindi natuloy ang bayad. Walang nakaltas; subukan ulit." : "Nag-expire ang payment link. Gumawa ng bago."}
          </p>
        )}
        {(!status || status.status === "pending") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-amber-500" /> Hinihintay ang kumpirmasyon ng bayad…
          </p>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setActive(null)
            setStatus(null)
          }}
        >
          Bumalik
        </Button>
      </div>
    )
  }

  // ---- Terminal ----------------------------------------------------------------
  return (
    <div className="flex flex-col gap-5">
      <Header />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">1 · Ano ang babayaran?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {offered.map((p) => {
            const when = p.deadlineId ? due.get(p.deadlineId) : undefined
            return (
              <button
                key={p.formId}
                onClick={() => choose(p)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left text-sm transition-colors",
                  formId === p.formId ? "border-primary bg-primary/10" : "hover:bg-muted"
                )}
              >
                <span className="font-medium">BIR {p.code}</span>
                <span className="text-xs text-muted-foreground">{p.label}</span>
                {when && <span className="mt-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">Due {when}</span>}
              </button>
            )
          })}
        </div>
      </section>

      {payable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">2 · Detalye ng bayad</h2>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Taxpayer" value={profile.businessName || profile.ownerName} />
            <Info label="TIN" value={tin || "—"} warn={!tin} />
            <Info label="RDO code" value={rdo || "—"} />
            <Info label="Form" value={`BIR ${payable.code}`} />
          </div>
          {!tin && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Wala pang TIN sa profile mo. I-upload ang COR sa Dokumento o sabihin kay Kuya Hermit.
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Return period
            <select className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ATC (Alphanumeric Tax Code, nasa return mo)
            <input className={input} value={atc} onChange={(e) => setAtc(e.target.value.toUpperCase())} placeholder="hal. PT010" maxLength={8} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Halagang babayaran (mula sa return mo)
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
              <input
                className={cn(input, "pl-7 text-lg font-semibold tabular-nums")}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-label="Amount in pesos"
              />
            </div>
          </label>
          <Link href={`/forms/${payable.formId}/fill`} className="text-xs text-primary">
            Wala pang return? Punan muna ang BIR {payable.code} →
          </Link>
        </section>
      )}

      {payable && (
        <section className="flex flex-col gap-3 rounded-2xl border p-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">3 · Review</h2>
          <dl className="flex flex-col gap-1 text-sm">
            <Row k="Babayaran" v={`BIR ${payable.code} · ${periods.find((x) => x.value === period)?.label ?? ""}`} />
            <Row k="Tax due" v={value ? peso(value) : "—"} />
            <Row k="Convenience fee" v="Ipapakita bago ka magbayad" muted />
          </dl>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm">Kabuuan</span>
            <span className="text-2xl font-semibold tabular-nums">{value ? peso(value) : "₱0.00"}</span>
          </div>
          <Button size="lg" disabled={!value || !tin || !period || pending} onClick={pay}>
            <Lock /> {pending ? "Ihinahanda…" : value ? `Magbayad ${peso(value)}` : "Magbayad"}
          </Button>
          <Methods />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notConnected && <NotConnected payable={payable} />}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Mga bayad mo</h2>
          <ul className="flex flex-col divide-y rounded-2xl border text-sm">
            {history.map((h) => (
              <li key={h.txnid} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.description}</span>
                  <span className="block text-xs text-muted-foreground">
                    {h.period} · {h.createdAt.slice(0, 10)} · {h.txnid}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums">{peso(h.amount)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS[h.status].tone)}>{STATUS[h.status].label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Magbayad ng buwis</h1>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" /> Secure na bayad sa pamamagitan ng eGovPay
      </p>
    </div>
  )
}

function Methods() {
  const items = [
    { icon: QrCode, label: "QR" },
    { icon: Wallet, label: "E-wallet" },
    { icon: Landmark, label: "Online banking" },
    { icon: CreditCard, label: "Card" },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        {items.map(({ icon: Icon, label }) => (
          <span key={label} className="flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] text-muted-foreground">
            <Icon className="size-5" /> {label}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Pipili ka ng paraan ng pagbayad sa secure page ng eGovPay (depende sa available na channels).</p>
    </div>
  )
}

function ScanToPay({ url }: { url: string }) {
  const [qr, setQr] = useState<string>()
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setQr)
  }, [url])
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center">
      <p className="flex items-center gap-2 font-medium">
        <QrCode className="size-5 text-primary" /> I-scan para magbayad
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt="Payment QR code" className="size-56 rounded-lg bg-white p-2" /> : <div className="size-56 animate-pulse rounded-lg bg-muted" />}
      <p className="text-xs text-muted-foreground">Buksan ang camera o banking app sa phone mo at i-scan, o buksan ang page dito.</p>
      <a href={url} target="_blank" rel="noreferrer" className={buttonVariants()}>
        <Smartphone /> Buksan ang payment page
      </a>
    </div>
  )
}

function Receipt({ p }: { p: PaymentView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl border p-6 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <p className="text-lg font-semibold">Bayad na!</p>
        <p className="text-3xl font-semibold tabular-nums">{peso(p.amount)}</p>
        <p className="text-sm text-muted-foreground">{p.description}</p>
      </div>
      <dl className="flex flex-col gap-1 rounded-2xl border p-4 text-sm">
        <Row k="Reference no." v={p.refno ?? "—"} />
        <Row k="Transaction" v={p.txnid} />
        <Row k="Return period" v={p.period ?? "—"} />
        <Row k="Channel" v={p.channel ?? "—"} />
        <Row k="Petsa" v={p.paidAt ? new Date(p.paidAt).toLocaleString("en-PH") : "—"} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Itago ang resibong ito at ang confirmation mula sa payment channel. Kung may return, i-file pa rin ito sa BIR.
      </p>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> I-print / I-save
        </Button>
        <Link href="/pay" className={buttonVariants({ variant: "ghost" })}>
          Bagong bayad
        </Link>
      </div>
    </div>
  )
}

function NotConnected({ payable }: { payable: Payable }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">Hindi pa available ang online payment sa HERMIT.</p>
      <p className="text-muted-foreground">Puwede kang magbayad ngayon gamit ang mga opisyal na channel ng BIR:</p>
      <a href="https://www.bir.gov.ph/ePay" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
        BIR ePayment channels <ExternalLink className="size-3.5" />
      </a>
      <a href="https://www.bir.gov.ph/authorized-agent-banks" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
        Authorized agent banks <ExternalLink className="size-3.5" />
      </a>
      <Link href={`/forms/${payable.formId}/fill`} className="text-primary">
        Buksan ang filled BIR {payable.code} →
      </Link>
    </div>
  )
}

function Info({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className={cn("truncate text-sm font-medium", warn && "text-amber-700 dark:text-amber-400")}>{value}</p>
    </div>
  )
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("text-right", muted && "text-muted-foreground")}>{v}</dd>
    </div>
  )
}
