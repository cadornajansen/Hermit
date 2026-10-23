"use client"

import { BadgeCheck, ScanFace } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { verifyNationalId } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { splitName } from "@/lib/fill"
import type { Profile } from "@/lib/types"

const PARTNER = process.env.NEXT_PUBLIC_EGOV_SSO_PARTNER_CODE
const SSO_HOST = process.env.NEXT_PUBLIC_EGOV_SSO_HOST
const LIVENESS_KEY = process.env.NEXT_PUBLIC_EGOV_LIVENESS_PUBKEY

const WIDGET_SRC = "https://widgets.e.gov.ph/v1.0.0/egov-login.min.js"
const LIVENESS_SRC = "https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js"

declare global {
  interface Window {
    EgovLogin?: { render(o: Record<string, unknown>): void }
    eKYC?: () => { start(o: { pubKey: string }): Promise<{ status: string; result?: { session_id?: string } }> }
  }
}

// One load promise per script, so a second caller waits for the same load.
const loading = new Map<string, Promise<void>>()
function loadScript(src: string) {
  let p = loading.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = Object.assign(document.createElement("script"), { src, async: true })
      s.onload = () => resolve()
      s.onerror = () => {
        loading.delete(src)
        reject(new Error(`Hindi ma-load ang ${new URL(src).host}`))
      }
      document.head.appendChild(s)
    })
    loading.set(src, p)
  }
  return p
}

// "Login as eGov" (official eGovPH widget). It runs mobile/email → OTP → PIN
// with eGovPH and hands back an exchange code; /egovph/sso redeems it.
export function EgovLogin({ disabled = false }: { disabled?: boolean }) {
  const target = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!PARTNER || !SSO_HOST) return
    let cancelled = false
    loadScript(WIDGET_SRC)
      .then(() => {
        if (cancelled || !window.EgovLogin || !target.current) return
        target.current.innerHTML = ""
        window.EgovLogin.render({
          target: target.current,
          partnerCode: PARTNER,
          host: SSO_HOST,
          partnerName: "HERMIT",
          onSuccess: ({ exchangeCode }: { exchangeCode: string }) => {
            // Full navigation: the server sets the sign-in cookies on this response.
            window.location.assign(new URL(`/egovph/sso?exchange_code=${encodeURIComponent(exchangeCode)}`, window.location.origin).href)
          },
          onError: () => setError("Hindi natapos ang eGovPH sign-in. Subukan ulit."),
        })
      })
      .catch((e) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  if (!PARTNER || !SSO_HOST)
    return (
      <a href="/egovph/sso?exchange_code=mock" aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault() }} className={`inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-base tracking-tight text-ink shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        Continue with <Image src="/brand/egov.png" alt="eGovPH" width={94} height={28} className="h-7 w-auto object-contain" />
      </a>
    )
  return (
    <div className={`flex flex-col gap-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <div ref={target} id="egov-login" className="min-h-12 rounded-full bg-white text-ink shadow-sm" />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// National ID check: eVerify's face-liveness SDK in the browser, then a
// PhilSys match on the server (app/actions.ts → verifyNationalId).
export function NationalIdCheck({
  profile,
  sso,
  onVerified,
}: {
  profile: Pick<Profile, "ownerName" | "birthDate" | "identityVerified">
  sso: boolean
  onVerified: (patch: Partial<Profile>) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (profile.identityVerified)
    return (
      <p className="flex items-center gap-2 text-sm text-primary">
        <BadgeCheck className="size-4" /> Verified sa National ID (PhilSys)
      </p>
    )

  async function run() {
    setError(undefined)
    setBusy(true)
    try {
      let sessionId = "mock-liveness"
      if (LIVENESS_KEY) {
        await loadScript(LIVENESS_SRC)
        const res = await window.eKYC!().start({ pubKey: LIVENESS_KEY }).catch(() => null)
        sessionId = res?.result?.session_id ?? ""
        if (!sessionId) {
          setError("Hindi natapos ang face scan.")
          return
        }
      }
      const name = splitName(profile.ownerName)
      const r = await verifyNationalId({ sessionId, firstName: name.first, middleName: name.middle, lastName: name.last, birthDate: profile.birthDate })
      if (r.ok) onVerified(r.profile)
      else setError(r.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hindi natapos ang verification.")
    } finally {
      setBusy(false)
    }
  }

  const ready = sso || (profile.ownerName.trim().split(/\s+/).length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate))
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm">
        I-verify ang pagkakakilanlan mo gamit ang National ID: kukunan ka ng selfie (face liveness) at itutugma sa PhilSys.
      </p>
      <Button onClick={run} disabled={busy || !ready} variant="secondary">
        <ScanFace /> {busy ? "Vine-verify…" : "I-verify gamit ang National ID"}
      </Button>
      {!ready && <p className="text-xs text-muted-foreground">Ilagay muna ang buong pangalan at kaarawan na nasa National ID mo.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Ang selfie ay ipinapadala lang sa eVerify ng gobyerno para sa pagtutugma; hindi ito sine-save ng HERMIT.
      </p>
    </div>
  )
}
