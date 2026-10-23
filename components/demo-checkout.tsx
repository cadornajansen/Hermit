"use client"

import { CheckCircle2, Lock, QrCode } from "lucide-react"
import { useEffect, useState } from "react"

import { completeDemoPayment, demoCheckout } from "@/app/pay"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { peso } from "@/lib/payments"

type View = Awaited<ReturnType<typeof demoCheckout>>

// What the payer's phone opens after scanning the demo QR: a mock bank /
// e-wallet confirmation screen. Nothing is charged; it only marks the demo
// transaction paid so the terminal can show the receipt and filing steps.
export function DemoCheckout({ txnid }: { txnid: string }) {
  const [v, setV] = useState<View | undefined>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    demoCheckout(txnid).then(setV, () => setV(null))
  }, [txnid])

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col gap-5 bg-canvas px-5 py-8">
      <Brand />
      <p className="self-start rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-800">Demo payment · no money will move</p>
      {v === undefined ? (
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      ) : v === null ? (
        <p className="rounded-2xl border bg-background p-5 text-sm">This payment link isn&apos;t valid or has expired.</p>
      ) : v.status === "paid" ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border bg-background p-6 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
          <p className="text-lg font-semibold">Payment sent</p>
          <p className="text-3xl font-semibold tabular-nums">{peso(v.amount)}</p>
          <p className="text-sm text-muted-foreground">{v.description}</p>
          <p className="font-mono text-xs">{v.refno}</p>
          <p className="text-xs text-muted-foreground">You can go back to HERMIT; your receipt is there.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border bg-background p-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCode className="size-4" aria-hidden /> Scanned QR · HERMIT Pay
          </p>
          <div>
            <p className="text-sm text-muted-foreground">Pay to</p>
            <p className="font-medium">{v.description}</p>
            {v.period && <p className="text-sm text-muted-foreground">Period {v.period}</p>}
          </div>
          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-sm">Amount</span>
            <span className="text-3xl font-semibold tabular-nums">{peso(v.amount)}</span>
          </div>
          <Button
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await completeDemoPayment(txnid)
              setV(await demoCheckout(txnid))
              setBusy(false)
            }}
          >
            <Lock /> {busy ? "Paying…" : `Pay ${peso(v.amount)} (demo)`}
          </Button>
          <p className="text-xs text-muted-foreground">
            Prototype checkout. In production this is your bank or e-wallet app paying through eGovPay / QR Ph.
          </p>
        </div>
      )}
    </main>
  )
}
