"use client"

import { Brain, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { integrationStatus } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { update, useProfile } from "@/lib/store"

const SERVICE: Record<string, string> = {
  sso: "eGovPH sign-in (SSO)",
  everify: "National ID check (eVerify)",
  emessage: "SMS reminders (eMessage)",
  ai: "eGov AI",
  pay: "Payments (eGovPay)",
  report: "eReport",
  chain: "eGovChain",
  "kuya hermit": "Kuya Hermit AI",
  "face liveness": "Face scan",
  database: "Database",
}

// What Kuya Hermit knows about the owner, so they never have to repeat
// themselves, and can see, correct or delete all of it.
export default function MemoryPage() {
  const { profile, docs } = useProfile()
  const [fact, setFact] = useState("")
  const [services, setServices] = useState<Record<string, string>>()
  useEffect(() => {
    integrationStatus().then(setServices, () => {})
  }, [])
  if (!profile) return null
  const en = profile.lang === "en"
  const memory = profile.memory ?? []
  const setMemory = (fn: (m: typeof memory) => typeof memory) =>
    update((s) => ({ profile: s.profile && { ...s.profile, memory: fn(s.profile.memory ?? []) } }))

  const known = [
    [en ? "Business" : "Negosyo", [profile.businessName, profile.description].filter(Boolean).join(" · ")],
    [en ? "Location" : "Lugar", [profile.barangay && `Brgy. ${profile.barangay}`, profile.city].filter(Boolean).join(", ")],
    [en ? "Type" : "Uri", [profile.structure, profile.category, profile.premises].filter((v) => v && v !== "unknown").join(" · ")],
    [en ? "Language" : "Wika", profile.lang === "en" ? "English" : "Filipino"],
    [en ? "Reminders" : "Paalala", profile.reminders.join(" + ").toUpperCase()],
    [en ? "Documents in vault" : "Dokumento sa vault", String(docs.length)],
  ].filter(([, v]) => v)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Brain className="size-6" aria-hidden /> {en ? "Memory" : "Mga naaalala ni Kuya Hermit"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {en
            ? "What Kuya Hermit remembers about you, from your chats and your profile, so it doesn't ask what it already knows. Delete anything you don't want it to keep."
            : "Ang mga naaalala ni Kuya Hermit tungkol sa iyo, mula sa mga usapan at profile mo, para hindi ka na tanungin ulit. Burahin ang ayaw mong itago niya."}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{en ? "From your chats" : "Mula sa mga usapan"}</h2>
        {memory.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {en ? "Nothing yet. Tell Kuya Hermit things like \"I plan to hire 2 staff in January\"." : "Wala pa. Sabihin kay Kuya Hermit, halimbawa: \"Balak kong kumuha ng 2 tauhan sa Enero\"."}
          </p>
        )}
        <ul className="flex flex-col divide-y rounded-2xl border">
          {memory.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <span>
                {m.text}
                <span className="block text-xs text-muted-foreground">
                  {m.source === "chat" ? (en ? "From chat" : "Mula sa chat") : en ? "Added by you" : "Idinagdag mo"} · {m.at.slice(0, 10)}
                </span>
              </span>
              <Button size="icon-sm" variant="ghost" aria-label={en ? `Forget: ${m.text}` : `Kalimutan: ${m.text}`} onClick={() => setMemory((list) => list.filter((x) => x.id !== m.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const text = fact.trim().slice(0, 160)
            if (!text) return
            setMemory((list) => [...list, { id: crypto.randomUUID(), text, source: "owner" as const, at: new Date().toISOString() }].slice(-50))
            setFact("")
          }}
        >
          <input
            className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm"
            placeholder={en ? "Add something Kuya Hermit should know" : "Magdagdag ng dapat malaman ni Kuya Hermit"}
            value={fact}
            maxLength={160}
            onChange={(e) => setFact(e.target.value)}
            aria-label={en ? "New memory" : "Bagong alaala"}
          />
          <Button type="submit" disabled={!fact.trim()}>
            {en ? "Add" : "Idagdag"}
          </Button>
        </form>
        {memory.length > 0 && (
          <Button variant="outline" className="self-start" onClick={() => confirm(en ? "Forget everything from chats?" : "Kalimutan lahat mula sa chat?") && setMemory(() => [])}>
            {en ? "Clear memory" : "Burahin lahat"}
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{en ? "From your profile" : "Mula sa profile mo"}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border p-3 text-sm">
          {known.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <Link href="/profile" className={buttonVariants({ variant: "outline", className: "self-start" })}>
          {en ? "Edit profile" : "I-edit ang profile"}
        </Link>
      </section>

      {services && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{en ? "Connected services" : "Mga konektadong serbisyo"}</h2>
          <ul className="flex flex-col divide-y rounded-2xl border text-sm">
            {Object.entries(services).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 p-3">
                <span>{SERVICE[k] ?? k}</span>
                <span className={/live|supabase/.test(v) ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{v}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
