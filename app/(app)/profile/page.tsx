"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { integrationStatus } from "@/app/actions"
import { signOut } from "@/app/register/actions"
import { deleteAllData } from "@/app/sync"
import { NationalIdCheck } from "@/components/egov-auth"
import { SavedFormInfo } from "@/components/saved-form-info"
import { label } from "@/components/onboarding"
import { activitySummary } from "@/lib/activities"
import { Button, buttonVariants } from "@/components/ui/button"
import { clearAll, flushSync, update, useProfile } from "@/lib/store"

// "What Hermit knows": every remembered fact is visible, editable, deletable.
export default function ProfilePage() {
  const s = useProfile()
  const router = useRouter()
  const [modes, setModes] = useState<Record<string, string>>()
  const [signOutError, setSignOutError] = useState("")
  useEffect(() => {
    integrationStatus().then(setModes)
  }, [])
  const p = s.profile
  if (!p) return null

  function exportData() {
    const data = JSON.stringify({ ...s, ready: undefined }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }))
    Object.assign(document.createElement("a"), { href: url, download: "hermit-data.json" }).click()
    URL.revokeObjectURL(url)
  }

  async function leaveAccount() {
    try {
      await flushSync()
      await signOut()
      router.push("/register")
      router.refresh()
    } catch {
      setSignOutError("Could not sign out. Please try again.")
    }
  }

  async function deleteEverything() {
    if (!confirm("Burahin lahat ng data mo sa HERMIT? Hindi na ito maibabalik.")) return
    try {
      await deleteAllData(s.ownerId!)
      clearAll()
      await signOut()
      router.push("/")
    } catch {
      update(() => ({ scopeError: "Could not delete data. Reload to verify your account and try again." }))
    }
  }

  const rows: [string, string][] = [
    ["Pangalan", `${p.ownerName}${p.identityVerified ? " ✓ verified" : ""}`],
    ["Kaarawan", p.birthDate || "—"],
    ["Mobile", p.mobile || "—"],
    ["Negosyo", p.businessName || "—"],
    ["Ginagawa", p.description || "—"],
    ["Activities", `${activitySummary(p)}${p.psic ? ` · PSIC ${p.psic}` : ""}`],
    ["Ownership", label("structure", p.structure)],
    ["Lugar", [p.businessAddress, p.barangay, p.city, p.province, p.region].filter(Boolean).join(", ") || "—"],
    ["Empleyado", label("employees", p.employees)],
    ["TIN", p.tin || "—"],
    ["RDO code", p.rdoCode || "—"],
    ["DTI / SEC no.", p.dtiNo || "—"],
    ...Object.entries(p.extra).map(([k, v]): [string, string] => [k, v]),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ang alam ni Hermit</h1>
        <p className="text-sm text-muted-foreground">
          Ginagamit lang ito para sa sarili mong filings. Naka-save sa device mo at sa secure na server ng HERMIT; walang
          naipapadala sa BIR o kahit anong ahensya nang hindi mo ginagawa.
        </p>
      </div>
      <dl className="divide-y rounded-2xl border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 p-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <NationalIdCheck
        profile={p}
        sso={false}
        onVerified={(patch) => update((st) => ({ profile: st.profile && { ...st.profile, ...patch } }))}
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/onboarding" className={buttonVariants()}>
          I-edit ang profile
        </Link>
        <Button variant="outline" onClick={exportData}>
          Export my data
        </Button>
        <Button variant="outline" onClick={leaveAccount}>Sign out</Button>
      </div>
      {signOutError && <p role="alert" className="text-sm text-destructive">{signOutError}</p>}

      <SavedFormInfo />

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-semibold">Usapan · Conversation memory</h2>
        <p className="text-muted-foreground">{s.chat.length} na mensahe kay Kuya Hermit.</p>
        <Button variant="outline" size="sm" className="self-start" onClick={() => update(() => ({ chat: [] }))} disabled={!s.chat.length}>
          Burahin ang usapan
        </Button>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="font-semibold">eGov integrations</h2>
        <ul className="grid grid-cols-2 gap-1 text-xs">
          {modes &&
            Object.entries(modes).map(([k, v]) => (
              <li key={k} className="flex justify-between rounded-lg bg-muted px-2 py-1">
                {k}{" "}
                <span className={v === "live" ? "text-primary" : "text-muted-foreground"}>{v}</span>
              </li>
            ))}
        </ul>
      </section>

      <Button variant="destructive" className="self-start" onClick={deleteEverything}>
        Burahin lahat · Delete all my data
      </Button>
    </div>
  )
}
