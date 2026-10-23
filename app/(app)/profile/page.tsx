"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactElement } from "react"

import { integrationStatus } from "@/app/actions"
import { signOut } from "@/app/register/actions"
import { deleteAllData } from "@/app/sync"
import { NationalIdCheck } from "@/components/egov-auth"
import { SavedFormInfo } from "@/components/saved-form-info"
import { label } from "@/components/onboarding"
import { activitySummary } from "@/lib/activities"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { clearAll, flushSync, update, useProfile } from "@/lib/store"

// "What Hermit knows": every remembered fact is visible, editable, deletable.
export default function ProfilePage(): ReactElement | null {
  const s = useProfile()
  const router = useRouter()
  const [modes, setModes] = useState<Record<string, string>>()
  const [signOutError, setSignOutError] = useState("")
  useEffect(() => {
    integrationStatus().then(setModes)
  }, [])
  const p = s.profile
  if (!p) return null

  function exportData(): void {
    const data = JSON.stringify({ ...s, ready: undefined }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }))
    Object.assign(document.createElement("a"), { href: url, download: "hermit-data.json" }).click()
    URL.revokeObjectURL(url)
  }

  async function leaveAccount(): Promise<void> {
    try {
      await flushSync()
      await signOut()
      router.push("/register")
      router.refresh()
    } catch {
      setSignOutError("Could not sign out. Please try again.")
    }
  }

  async function deleteEverything(): Promise<void> {
    if (!confirm("Delete all your HERMIT data? This cannot be undone.")) return
    try {
      await deleteAllData(s.ownerId!)
      clearAll()
      await signOut()
      router.push("/")
    } catch {
      update(() => ({ scopeError: "Could not delete data. Reload to verify your account and try again." }))
    }
  }

  const accountRows: [string, string][] = [
    ["Full name", p.ownerName || "—"],
    ["Date of birth", p.birthDate || "—"],
    ["Mobile", p.mobile || "—"],
    ["Contact email", p.email || "—"],
  ]
  const businessRows: [string, string][] = [
    ["Business name", p.businessName || "—"],
    ["Description", p.description || "—"],
    ["Activities", `${activitySummary(p)}${p.psic ? ` · PSIC ${p.psic}` : ""}`],
    ["Ownership", label("structure", p.structure)],
    ["Location", [p.businessAddress, p.barangay, p.city, p.province, p.region].filter(Boolean).join(", ") || "—"],
    ["Employees", label("employees", p.employees)],
    ["TIN", p.tin || "—"],
    ["RDO code", p.rdoCode || "—"],
    ["DTI / SEC no.", p.dtiNo || "—"],
    ...Object.entries(p.extra).map(([k, v]): [string, string] => [k, v]),
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Review the details Hermit uses for your filings and manage your saved information.
          </p>
        </div>
        <Link href="/onboarding" className={buttonVariants({ size: "sm" })}>
          Edit profile
        </Link>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card size="sm" aria-labelledby="account-heading">
          <CardHeader>
            <CardTitle><h2 id="account-heading">Account details</h2></CardTitle>
            <CardDescription>Your contact information and identity verification.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProfileDetails rows={accountRows} />
            <NationalIdCheck
              profile={p}
              sso={false}
              onVerified={(patch) => update((st) => ({ profile: st.profile && { ...st.profile, ...patch } }))}
            />
          </CardContent>
          <CardFooter className="flex-col items-start gap-3 border-t">
            <Button variant="outline" size="sm" onClick={leaveAccount}>Sign out</Button>
            {signOutError && (
              <Alert variant="destructive">
                <AlertDescription>{signOutError}</AlertDescription>
              </Alert>
            )}
          </CardFooter>
        </Card>

        <Card size="sm" aria-labelledby="business-heading">
          <CardHeader>
            <CardTitle><h2 id="business-heading">Business details</h2></CardTitle>
            <CardDescription>Information used to prepare your roadmap and forms.</CardDescription>
          </CardHeader>
          <CardContent><ProfileDetails rows={businessRows} /></CardContent>
        </Card>
      </div>

      <SavedFormInfo />

      <Card size="sm" aria-labelledby="data-heading">
        <CardHeader>
          <CardTitle><h2 id="data-heading">Data controls</h2></CardTitle>
          <CardDescription>Download a copy of your information or remove what you no longer need.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">Export your data</h3>
              <p className="text-sm text-muted-foreground">Download your current Hermit information as a JSON file.</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportData}>Export my data</Button>
          </div>
          <div className="flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">Conversation history</h3>
              <p className="text-sm text-muted-foreground">
                {s.chat.length} saved {s.chat.length === 1 ? "message" : "messages"} with Kuya Hermit.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => update(() => ({ chat: [] }))} disabled={!s.chat.length}>
              Clear conversation
            </Button>
          </div>
          <div className="flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">Delete all data</h3>
              <p className="text-sm text-muted-foreground">Permanently remove your Hermit data and sign out. This cannot be undone.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={deleteEverything}>Delete all my data</Button>
          </div>
        </CardContent>
      </Card>

      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground">eGov integration status</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {modes &&
            Object.entries(modes).map(([name, mode]) => (
              <div key={name} className="flex justify-between gap-3">
                <dt>{name}</dt>
                <dd className={mode === "live" ? "text-primary" : "text-muted-foreground"}>{mode}</dd>
              </div>
            ))}
        </dl>
      </details>
    </div>
  )
}

function ProfileDetails({ rows }: { rows: [string, string][] }): ReactElement {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {rows.map(([name, value]) => (
        <div key={name} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
