"use client"

import { ExternalLink, Send } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { askHermit } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { getForm } from "@/lib/forms"
import { update, useProfile, type ChatMessage } from "@/lib/store"

const SUGGESTIONS = [
  "Ano ang dadalhin ko sa BIR registration?",
  "Kailangan ko ba ng Mayor's Permit kung online lang ako?",
  "Paano maging BMBE?",
]

export function Chat({ initialQuestion }: { initialQuestion: string }) {
  const { profile, chat } = useProfile()
  const [q, setQ] = useState(initialQuestion)
  const [pending, start] = useTransition()
  if (!profile) return null

  function ask(question: string) {
    if (!question.trim()) return
    const mine: ChatMessage = { role: "owner", text: question, at: new Date().toISOString() }
    update((s) => ({ chat: [...s.chat, mine] }))
    setQ("")
    start(async () => {
      const r = await askHermit(question, profile!)
      if (!r) return
      update((s) => ({
        chat: [...s.chat, { role: "hermit", text: r.answer, sources: r.sources, formIds: r.formIds, at: new Date().toISOString() }],
      }))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kuya Hermit</h1>
        <p className="text-sm text-muted-foreground">
          Sumasagot lang mula sa opisyal na sources at sa profile mo. Hindi siya nagpa-file para sa iyo.
        </p>
      </div>

      {chat.length === 0 && (
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="outline" className="h-auto justify-start py-2 text-left whitespace-normal" onClick={() => ask(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {chat.map((m, i) => (
          <li
            key={i}
            className={
              m.role === "owner"
                ? "ml-10 self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                : "mr-6 flex flex-col gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm"
            }
          >
            <p className="whitespace-pre-wrap">{m.text.replaceAll("**", "").replaceAll("_", "")}</p>
            {m.formIds?.map((f) => (
              <Link key={f} href={`/forms/${f}`} className={buttonVariants({ size: "sm" })}>
                Pre-fill {getForm(f)?.short}
              </Link>
            ))}
            {!!m.sources?.length && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {m.sources.map((s) => (
                  <li key={s.name}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                      {s.name} <ExternalLink className="size-3" />
                    </a>{" "}
                    · {s.lastVerified ? `verified ${s.lastVerified}` : "not yet verified"}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {pending && <li className="mr-6 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Nag-iisip…</li>}
      </ol>

      <form
        className="sticky bottom-20 flex gap-2 bg-background py-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask(q)
        }}
      >
        <input
          className="h-11 flex-1 rounded-xl border bg-background px-3 text-base"
          placeholder="Magtanong… · Ask anything"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Your question"
        />
        <Button type="submit" size="icon-lg" disabled={pending || !q.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  )
}
