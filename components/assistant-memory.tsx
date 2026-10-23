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
  "kuya hermit": "Ask Hermit AI",
  "face liveness": "Face scan",
  database: "Database",
}

export function AssistantMemory({ active }: { active: boolean }) {
  const { profile, docs, ownerId } = useProfile()
  const [fact, setFact] = useState("")
  const [services, setServices] = useState<Record<string, string>>()
  useEffect(() => {
    if (!active) return
    let cancelled = false
    integrationStatus().then((result) => {
      if (!cancelled) setServices(result)
    }, () => {})
    return () => { cancelled = true }
  }, [active])
  if (!profile) return null
  const memory = profile.memory ?? []
  const setMemory = (fn: (m: typeof memory) => typeof memory) =>
    update((s) => s.ownerId === ownerId ? { profile: s.profile && { ...s.profile, memory: fn(s.profile.memory ?? []) } } : {})

  const known = [
    ["Business", [profile.businessName, profile.description].filter(Boolean).join(" · ")],
    ["Location", [profile.barangay && `Brgy. ${profile.barangay}`, profile.city].filter(Boolean).join(", ")],
    ["Type", [profile.structure, profile.category, profile.premises].filter((v) => v && v !== "unknown").join(" · ")],
    ["Language", profile.lang === "en" ? "English" : "Filipino"],
    ["Reminders", profile.reminders.join(" + ").toUpperCase()],
    ["Documents in vault", String(docs.length)],
  ].filter(([, v]) => v)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Brain className="size-5" aria-hidden /> Memory
        </h2>
        <p className="text-sm text-muted-foreground">
          What Hermit remembers from your chats and profile. Delete anything you don&apos;t want it to keep.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">From your chats</h3>
        {memory.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet. Try adding &ldquo;I plan to hire 2 staff in January&rdquo;.
          </p>
        )}
        <ul className="flex flex-col divide-y rounded-2xl border">
          {memory.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <span>
                {m.text}
                <span className="block text-xs text-muted-foreground">
                  {m.source === "chat" ? "From chat" : "Added by you"} · {m.at.slice(0, 10)}
                </span>
              </span>
              <Button size="icon" variant="ghost" aria-label={`Forget: ${m.text}`} onClick={() => setMemory((list) => list.filter((x) => x.id !== m.id))}>
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
            className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm"
            placeholder="Add something Hermit should know"
            value={fact}
            maxLength={160}
            onChange={(e) => setFact(e.target.value)}
            aria-label="New memory"
          />
          <Button type="submit" disabled={!fact.trim()}>
            Add
          </Button>
        </form>
        {memory.length > 0 && (
          <Button variant="outline" className="self-start" onClick={() => confirm("Forget everything from chats?") && setMemory(() => [])}>
            Clear memory
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">From your profile</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border p-3 text-sm">
          {known.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <Link href="/profile" className={buttonVariants({ variant: "outline", className: "self-start" })}>
          Edit profile
        </Link>
      </section>

      {services && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Connected services</h3>
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
