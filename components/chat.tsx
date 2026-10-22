"use client"

import { ExternalLink, Send } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { askHermit } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { getForm } from "@/lib/forms"
import { update, useProfile, type ChatMessage } from "@/lib/store"
import { cn } from "@/lib/utils"

const SUGGESTIONS = {
  fil: [
    "Ano ang dadalhin ko sa BIR registration?",
    "Pakifill-up ang BIR Form 1901 ko",
    "Ano ang mga deadline ko ngayong buwan?",
    "Kailangan ko ba ng Mayor's Permit kung online lang ako?",
  ],
  en: [
    "What do I bring for BIR registration?",
    "Fill in my BIR Form 1901",
    "What are my deadlines this month?",
    "Which documents am I still missing?",
  ],
}

export function Chat({ initialQuestion }: { initialQuestion: string }) {
  const { profile, chat, items, docs } = useProfile()
  const [q, setQ] = useState(initialQuestion)
  const [pending, start] = useTransition()
  if (!profile) return null

  function ask(question: string) {
    if (!question.trim()) return
    const mine: ChatMessage = { role: "owner", text: question, at: new Date().toISOString() }
    update((s) => ({ chat: [...s.chat, mine] }))
    setQ("")
    start(async () => {
      const r = await askHermit({
        question,
        history: chat.map((m) => ({ role: m.role, text: m.text })),
        profile: profile!,
        items,
        docs: docs.map((d) => ({
          type: d.extracted.docType,
          verdict: d.verdict,
          expiresOn: d.extracted.expiresOn,
          requirementId: d.requirementId,
          fileName: d.fileName,
        })),
      }).catch(() => null)
      const answer: ChatMessage = r
        ? { role: "hermit", text: r.answer, sources: r.sources, formIds: r.formIds, at: new Date().toISOString() }
        : { role: "hermit", text: "Pasensya, hindi kita ma-reach ngayon. Subukan ulit mamaya. · Sorry, I can't connect right now.", at: new Date().toISOString() }
      update((s) => ({
        chat: [...s.chat, answer],
        // Values the owner gave Kuya Hermit for missing form fields.
        profile: r && Object.keys(r.saved).length && s.profile ? { ...s.profile, extra: { ...s.profile.extra, ...r.saved } } : s.profile,
      }))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Kuya Hermit</h1>
          <div role="radiogroup" aria-label="Wika · Language" className="flex rounded-full border p-0.5 text-xs">
            {(["fil", "en"] as const).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={profile.lang === l}
                onClick={() => update((s) => ({ profile: s.profile && { ...s.profile, lang: l } }))}
                className={cn("rounded-full px-3 py-1", profile.lang === l && "bg-primary text-primary-foreground")}
              >
                {l === "fil" ? "Filipino" : "English"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.lang === "en"
            ? "Answers only from official sources and your own records. Ask in Filipino or English. It prepares forms; you file them."
            : "Sumasagot lang mula sa opisyal na sources at sa records mo. Magtanong sa Filipino o English. Ihahanda niya ang forms; ikaw ang magpa-file."}
        </p>
      </div>

      {chat.length === 0 && (
        <div className="flex flex-col gap-2">
          {SUGGESTIONS[profile.lang].map((s) => (
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
            <p className="break-words whitespace-pre-wrap">{linkify(m.text.replaceAll("**", "").replace(/^#+ /gm, ""))}</p>
            {m.formIds?.map((f) => (
              <Link key={f} href={`/forms/${f}`} className={buttonVariants({ size: "sm" })}>
                Pre-fill {getForm(f)?.short}
              </Link>
            ))}
            {m.role === "hermit" && (
              <p className="text-[11px] text-muted-foreground">Hindi ito legal o tax advice · Not legal or tax advice</p>
            )}
            {!!m.sources?.length && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {m.sources.map((s) => (
                  <li key={s.name}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                      {s.name} <ExternalLink className="size-3" />
                    </a>{" "}
                    · {s.copiedOn ? `official copy, ${s.copiedOn}` : s.lastVerified ? `verified ${s.lastVerified}` : "not yet verified"}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {pending && (
          <li className="mr-6 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {profile.lang === "en" ? "Thinking…" : "Nag-iisip…"}
          </li>
        )}
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
          placeholder={profile.lang === "en" ? "Ask anything…" : "Magtanong…"}
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

// Make the exact URLs Kuya Hermit gives tappable.
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s)<>"]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part.replace(/[.,;:]+$/, "")} target="_blank" rel="noreferrer" className="underline">
        {part}
      </a>
    ) : (
      part
    )
  )
}
