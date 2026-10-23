"use client"

import { Brain, Download, ExternalLink, FileText, Mic, Send } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { documentUrl } from "@/app/sync"
import { HermitCards, StepTimeline } from "@/components/chat-cards"
import { Button, buttonVariants } from "@/components/ui/button"
import { getFile } from "@/lib/files"
import { getForm } from "@/lib/forms"
import type { HermitReply, HermitStep } from "@/lib/hermit"
import { buildPacket, packetPlan, slotAvailability, slotName, usable } from "@/lib/pack"
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
  const { profile, chat, items, docs, ownerId } = useProfile()
  const [q, setQ] = useState(initialQuestion)
  const [pending, setPending] = useState(false)
  const [live, setLive] = useState<HermitStep[]>([])
  const voice = useVoice(profile?.lang === "en" ? "en-PH" : "fil-PH", (t) => setQ(t))
  // Follow the conversation and Kuya Hermit's live steps.
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [chat.length, live.length, pending])
  if (!profile) return null
  const en = profile.lang === "en"

  async function ask(question: string) {
    if (!question.trim() || pending) return
    const mine: ChatMessage = { role: "owner", text: question, at: new Date().toISOString() }
    update((s) => ({ chat: [...s.chat, mine] }))
    setQ("")
    setPending(true)
    setLive([])
    {
      const r = await streamHermit(
        {
        expectedOwnerId: ownerId!,
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
        },
        (step) => setLive((l) => [...l.filter((x) => x.id !== step.id), step])
      ).catch(() => null)
      setPending(false)
      setLive([])
      const answer: ChatMessage = r
        ? { role: "hermit", text: r.answer, sources: r.sources, formIds: r.formIds, packs: r.packs, steps: r.steps, cards: r.cards, ms: r.ms, at: new Date().toISOString() }
        : { role: "hermit", text: "Pasensya, hindi kita ma-reach ngayon. Subukan ulit mamaya. · Sorry, I can't connect right now.", at: new Date().toISOString() }
      update((s) =>
        s.ownerId !== ownerId
          ? {}
          : {
              chat: [...s.chat, answer],
              // Facts the owner asked Kuya Hermit to keep (Memory page).
              profile:
                r?.remembered?.length && s.profile
                  ? {
                      ...s.profile,
                      memory: [
                        ...(s.profile.memory ?? []),
                        ...r.remembered
                          .filter((t) => !s.profile!.memory?.some((m) => m.text === t))
                          .map((text) => ({ id: crypto.randomUUID(), text, source: "chat" as const, at: new Date().toISOString() })),
                      ].slice(-50),
                    }
                  : s.profile,
              // Chat suggestions are current-form edits, never consent for reuse.
              formEdits: r
                ? {
                    ...s.formEdits,
                    ...Object.fromEntries(
                      r.formIds.map((id) => [
                        id,
                        { ...r.saved, ...s.formEdits[id] },
                      ])
                    ),
                  }
                : s.formEdits,
            }
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Kuya Hermit</h1>
          <Link href="/memory" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" aria-label="Memory">
            <Brain className="size-4" aria-hidden /> {en ? "Memory" : "Naaalala"}
          </Link>
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
            {m.role === "hermit" && m.steps && <StepTimeline steps={m.steps} ms={m.ms} en={en} />}
            <p className="break-words whitespace-pre-wrap">{linkify(m.text.replaceAll("**", "").replace(/^#+ /gm, ""))}</p>
            {m.formIds?.map((f) => (
              <Link key={f} href={`/forms/${f}`} className={buttonVariants({ size: "sm" })}>
                Pre-fill {getForm(f)?.short}
              </Link>
            ))}
            {m.packs?.map((id) => <PacketCard key={id} requirementId={id} />)}
            {m.cards && <HermitCards cards={m.cards} onAsk={ask} />}
            {m.steps?.some((st) => st.tool === "remember" && st.ok) && (
              <Link href="/memory" className="flex items-center gap-1 text-xs text-muted-foreground">
                <Brain className="size-3.5" /> {en ? "Saved to memory · view or delete" : "Naitala sa memory · tingnan o burahin"}
              </Link>
            )}
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
                    ·{" "}
                    {s.copiedOn ? `official copy, ${s.copiedOn}` : s.lastVerified ? `verified ${s.lastVerified}` : "not yet verified"}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {pending && (
          <li className="mr-6 rounded-2xl bg-muted px-4 py-3 text-sm" aria-live="polite">
            <StepTimeline steps={live} live en={en} />
          </li>
        )}
      </ol>
      <div ref={end} />

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
        {voice.supported && (
          <Button
            type="button"
            size="icon-lg"
            variant={voice.listening ? "default" : "outline"}
            onClick={voice.toggle}
            aria-label={voice.listening ? "Stop listening" : en ? "Speak your question" : "Sabihin ang tanong"}
            aria-pressed={voice.listening}
          >
            <Mic className={cn(voice.listening && "animate-pulse")} />
          </Button>
        )}
        <Button type="submit" size="icon-lg" disabled={pending || !q.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  )
}

// POST to the streaming endpoint; report each step as it happens.
async function streamHermit(input: unknown, onStep: (s: HermitStep) => void): Promise<HermitReply | null> {
  const res = await fetch("/api/hermit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
  if (!res.ok || !res.body) return null
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return null
    buf += value
    const lines = buf.split("\n")
    buf = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      const ev = JSON.parse(line)
      if (ev.type === "step") onStep(ev.step)
      else if (ev.type === "done") return ev.reply
      else if (ev.type === "error") throw new Error(ev.message)
    }
  }
}

type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null }

// Speak instead of type: the browser's own speech recognition (Chrome, Edge,
// Safari), Filipino or English. Hidden where the browser has none.
function useVoice(lang: string, onText: (t: string) => void) {
  const rec = useRef<Recognizer | null>(null)
  const supported = useSyncExternalStore(
    () => () => {},
    () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    () => false
  )
  const [listening, setListening] = useState(false)
  useEffect(() => () => rec.current?.stop(), [])
  function toggle() {
    if (listening) return rec.current?.stop()
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer }
    const R = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!R) return
    const r = new R()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => onText(Array.from(e.results, (x) => x[0].transcript).join(""))
    r.onend = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }
  return { supported, listening, toggle }
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

// The filled document packet the owner said yes to. Built on the device from
// their profile, form edits and vault files; nothing is uploaded.
function PacketCard({ requirementId }: { requirementId: string }) {
  const { profile, docs, formMemory, formEdits, ownerId, pdfDrafts } =
    useProfile()
  const [status, setStatus] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [task, setTask] = useState<import("@/lib/forms").FilingTask>("new")
  const context = {
    ...(requirementId === "bir_cor" || requirementId === "dti_bn" ? { task } : {}),
    memory: formMemory,
    edits: formEdits,
    ownerId,
    drafts: pdfDrafts,
  }
  const plan = profile && packetPlan(requirementId, profile, docs, context)
  if (!profile || !plan) return null
  const en = profile.lang === "en"

  async function download() {
    setBusy(true)
    setStatus(undefined)
    try {
      const bytes = await buildPacket(
        plan!,
        profile!,
        async (d) => {
          const local = await getFile(d.id).catch(() => undefined)
          if (local) return local
          const url = await documentUrl(d.id)
          if (!url) return undefined
          const response = await fetch(url)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.blob()
        },
        context
      )
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/pdf" }))
      Object.assign(document.createElement("a"), { href: url, download: `HERMIT-${plan!.requirement.id}-packet.pdf` }).click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setStatus(en ? "Downloaded. Check every page and sign before filing." : "Na-download na. Suriin ang bawat pahina at pumirma bago i-file.")
    } catch (e) {
      console.error(e)
      setStatus(en ? "Couldn't build the PDF. Try again." : "Hindi nagawa ang PDF. Subukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3 text-xs">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4" />{" "}
        {en ? "Document packet" : "Document packet"}: {plan.requirement.name}
      </p>
      {(requirementId === "bir_cor" || requirementId === "dti_bn") && (
        <label className="flex flex-col gap-1">
          Filing task
          <select value={task} onChange={(event) => setTask(event.target.value as import("@/lib/forms").FilingTask)} className="h-9 rounded-lg border bg-background px-2">
            <option value="new">New registration</option>
            {requirementId === "bir_cor" ? <><option value="update">Update / cancellation</option><option value="abatement">Abatement</option></> : <option value="renewal">Renewal</option>}
          </select>
        </label>
      )}
      <ul className="flex flex-col gap-0.5">
        {plan.forms.map((f) => (
          <li key={f.form.id}>
            ✓ {f.form.name}{" "}
            <Link
              href={`/forms/${f.form.id}`}
              className="text-primary underline"
            >
              Review / edit / save answers
            </Link>
            <span className="text-muted-foreground">
              {f.file && f.layout ? " · official PDF if available; info sheet on failure" : " · info sheet"}
              {` · ${f.reason}`}
              {f.missing.length ? ` · ${f.missing.length} ${en ? "blank" : "blanko pa"}` : ""}
            </span>
          </li>
        ))}
        {plan.letter && (
          <li>
            ✓{" "}
            {en ? "Property owner's consent letter (for them to sign)" : "Liham ng pahintulot ng may-ari ng lugar (papirmahan)"}
          </li>
        )}
        {plan.needs.map((s) => (
          <li key={s.types.join()} className={usable(s) ? undefined : "text-amber-700 dark:text-amber-400"}>
            {usable(s) ? "✓" : "✗"} {slotName(s)}
            {` · ${slotAvailability(s)}`}
          </li>
        ))}
      </ul>
      <Button size="sm" onClick={download} disabled={busy}>
        <Download />{" "}
        {busy ? (en ? "Preparing…" : "Inihahanda…") : en ? "Download PDF packet" : "I-download ang PDF packet"}
      </Button>
      {plan.forms
        .filter((f) => f.file && f.layout)
        .map((f) => (
          <Link key={f.form.id} href={`/forms/${f.form.id}/fill?file=${encodeURIComponent(f.file!.path)}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            {en ? `Review / sign ${f.form.short}` : `I-review / pirmahan ang ${f.form.short}`}
          </Link>
        ))}
      {status && <p role="status">{status}</p>}
    </div>
  )
}
