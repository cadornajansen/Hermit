"use client"

import { CheckCircle2, CircleAlert, CircleX, FileUp, RefreshCw } from "lucide-react"
import { useRef, useState, useTransition } from "react"

import { readDocument } from "@/app/actions"
import { documentUrl } from "@/app/sync"
import { Button } from "@/components/ui/button"
import { buildChecklist, defaultExpiry, getRequirement } from "@/lib/engine"
import { deleteFile, getFile, putFile, sha256 } from "@/lib/files"
import { update, useProfile, type Saved } from "@/lib/store"
import type { DocType, Extracted, Profile, VaultDoc } from "@/lib/types"
import { cn } from "@/lib/utils"
import { coverage, DOC_TYPES, docName, REQUIREMENT_DOCS, verifyDocument } from "@/lib/vault"

export const VERDICT: Record<VaultDoc["verdict"], { label: string; tone: string }> = {
  verified: { label: "Tama · Verified", tone: "bg-primary/15 text-primary" },
  needs_review: { label: "I-check · Needs review", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  rejected: { label: "Mali · Fix needed", tone: "bg-destructive/15 text-destructive" },
}

const CHECK_ICON = {
  pass: <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="pass" />,
  warn: <CircleAlert className="size-4 shrink-0 text-amber-600" aria-label="warning" />,
  fail: <CircleX className="size-4 shrink-0 text-destructive" aria-label="fail" />,
}

const input = "h-10 w-full rounded-lg border bg-background px-3 text-sm"

// Which checklist item an issued document completes.
function issuedFor(doc: VaultDoc, profile: Profile) {
  const ids = Object.keys(REQUIREMENT_DOCS).filter((id) => REQUIREMENT_DOCS[id].issues === doc.extracted.docType)
  if (doc.requirementId && ids.includes(doc.requirementId)) return doc.requirementId
  const applicable = new Set(buildChecklist(profile, {}).map((i) => i.id))
  return ids.find((id) => applicable.has(id))
}

// Saves a document, appends to the activity log, and — once verified — feeds
// the rest of HERMIT: numbers for form pre-fill, checklist status, expiry.
function record(doc: VaultDoc, events: string[]) {
  update((s) => {
    const at = new Date().toISOString()
    const patch: Partial<Saved> = { docs: [doc, ...s.docs.filter((d) => d.id !== doc.id)] }
    const e = doc.extracted
    if (doc.verdict === "verified" && s.profile && e.docType !== "unknown") {
      const key = DOC_TYPES[e.docType].formKey
      const extra = { ...s.profile.extra }
      if (e.tin) extra.tin = e.tin
      if (key && key !== "tin" && e.number) extra[key] = e.number
      if (JSON.stringify(extra) !== JSON.stringify(s.profile.extra)) {
        patch.profile = { ...s.profile, extra }
        events.push("Na-save ang numero para sa form pre-fill")
      }
      const reqId = issuedFor(doc, s.profile)
      if (reqId && s.items[reqId]?.status !== "approved") {
        const expiresOn = e.expiresOn || defaultExpiry(reqId)
        patch.items = { ...s.items, [reqId]: { status: "approved", expiresOn } }
        events.push(`Checklist: ${getRequirement(reqId)?.name} → Approved${expiresOn ? `, expires ${expiresOn}` : ""}`)
      }
    }
    const log = events.map((event) => ({ at, docId: doc.id, docName: doc.fileName, event }))
    return { ...patch, vaultLog: [...log, ...s.vaultLog].slice(0, 500) }
  })
}

const verdictEvent = (doc: VaultDoc) => {
  const problems = doc.checks.filter((c) => c.result !== "pass").length
  return `Resulta: ${VERDICT[doc.verdict].label}${problems ? ` (${problems} problema)` : ""}`
}

export function Vault({ initialRequirement, initialType }: { initialRequirement: string; initialType: string }) {
  const { profile, items, docs, vaultLog } = useProfile()
  const [reqId, setReqId] = useState(initialRequirement)
  const [type, setType] = useState<DocType | "">(initialType in DOC_TYPES ? (initialType as DocType) : "")
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  if (!profile) return null

  const checklist = buildChecklist(profile, items).filter((i) => REQUIREMENT_DOCS[i.id])
  const spec = REQUIREMENT_DOCS[reqId]
  const slotTypes = spec ? [...new Set([...spec.needs.flat(), ...(spec.issues ? [spec.issues] : [])])] : []
  const missing = checklist.flatMap((item) => {
    const c = coverage(item.id, docs)!
    return c.needs
      .filter((slot) => !slot.doc || slot.doc.verdict === "rejected")
      .map((slot) => ({ item, slot }))
  })
  const counts = { verified: 0, needs_review: 0, rejected: 0 }
  for (const d of docs) counts[d.verdict]++

  function upload(file: File) {
    setError(undefined)
    start(async () => {
      const id = crypto.randomUUID()
      const [hash] = await Promise.all([sha256(file), putFile(id, file)])
      const fd = new FormData()
      fd.set("file", file)
      fd.set("id", id)
      const r = await readDocument(fd)
      if (!r.ok) {
        await deleteFile(id)
        setError(r.error)
        return
      }
      const expectedTypes: DocType[] = type ? [type] : slotTypes
      const extracted: Extracted =
        r.extracted.docType === "unknown" && type ? { ...r.extracted, docType: type } : r.extracted
      const base = { id, sha256: hash, expectedTypes, extracted, ownerConfirmed: false }
      const doc: VaultDoc = {
        ...base,
        ...verifyDocument(base, profile!, docs),
        fileName: file.name,
        mime: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        requirementId: reqId || undefined,
        storagePath: r.storagePath,
      }
      record(doc, [
        `Na-upload${reqId ? ` para sa ${getRequirement(reqId)?.name}` : ""}`,
        r.reader
          ? `Binasa ni ${r.reader}: ${docName(extracted.docType)}`
          : `Hindi mabasa ng AI ang laman (larawan o scan) — hinulaan mula sa filename: ${docName(extracted.docType)}. I-type ang detalye.`,
        verdictEvent(doc),
      ])
      if (fileRef.current) fileRef.current.value = ""
    })
  }

  function recheckAll() {
    for (const d of docs) {
      const next = { ...d, ...verifyDocument(d, profile!, docs) }
      if (next.verdict !== d.verdict) record(next, [`Na-verify ulit: ${VERDICT[d.verdict].label} → ${VERDICT[next.verdict].label}`])
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mga dokumento</h1>
        <p className="text-sm text-muted-foreground">
          I-upload ang permits at requirements mo. Babasahin ito ng AI at iche-check ni Hermit kung tama ang dokumento,
          pareho ang pangalan, at hindi pa expired. Naka-save ang files sa device mo at sa private storage ng HERMIT.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        {(Object.keys(VERDICT) as VaultDoc["verdict"][]).map((v) => (
          <div key={v} className={cn("rounded-xl p-3", VERDICT[v].tone)}>
            <p className="text-2xl font-semibold tabular-nums">{counts[v]}</p>
            <p className="text-xs">{VERDICT[v].label.split(" · ")[1]}</p>
          </div>
        ))}
      </div>

      <form
        ref={formRef}
        className="flex flex-col gap-3 rounded-2xl border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          const f = fileRef.current?.files?.[0]
          if (f) upload(f)
        }}
      >
        <h2 className="font-semibold">Mag-upload</h2>
        <label className="flex flex-col gap-1 text-sm">
          Para saan? · For which requirement
          <select className={input} value={reqId} onChange={(e) => { setReqId(e.target.value); setType("") }}>
            <option value="">Pangkalahatan · General</option>
            {checklist.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Anong dokumento? · Document type
          <select className={input} value={type} onChange={(e) => setType(e.target.value as DocType | "")}>
            <option value="">Hayaan si Hermit na tukuyin · Detect</option>
            {(slotTypes.length ? slotTypes : (Object.keys(DOC_TYPES) as DocType[])).map((t) => (
              <option key={t} value={t}>
                {docName(t)}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2"
          aria-label="Choose a file"
          required
        />
        <Button type="submit" size="lg" disabled={pending}>
          <FileUp /> {pending ? "Binabasa at vine-verify…" : "I-upload at i-verify"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">PDF o larawan, hanggang 10MB. Puwedeng kunan ng litrato gamit ang phone.</p>
      </form>

      {missing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Kulang pa · Still needed</h2>
          <ul className="flex flex-col divide-y rounded-2xl border text-sm">
            {missing.map(({ item, slot }) => (
              <li key={item.id + slot.types.join()} className="flex items-center justify-between gap-3 p-3">
                <span>
                  {slot.types.map(docName).join(" / ")}
                  <span className="block text-xs text-muted-foreground">
                    para sa {item.name}
                    {slot.doc && " · na-reject ang na-upload"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReqId(item.id)
                    setType(slot.types.length === 1 ? slot.types[0] : "")
                    formRef.current?.scrollIntoView({ behavior: "smooth" })
                  }}
                >
                  I-upload
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {docs.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Naka-file · On file</h2>
            <Button size="sm" variant="ghost" onClick={recheckAll}>
              <RefreshCw /> I-verify ulit lahat
            </Button>
          </div>
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} profile={profile} docs={docs} log={vaultLog.filter((l) => l.docId === d.id)} />
          ))}
        </section>
      )}

      {vaultLog.length > 0 && (
        <details className="rounded-2xl border p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Kasaysayan · Activity log ({vaultLog.length})</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {vaultLog.slice(0, 100).map((l, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
                <time className="text-muted-foreground tabular-nums">{new Date(l.at).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })}</time>
                <span>
                  <span className="font-medium">{l.docName}</span> — {l.event}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function DocCard({ doc, profile, docs, log }: { doc: VaultDoc; profile: Profile; docs: VaultDoc[]; log: Saved["vaultLog"] }) {
  const [editing, setEditing] = useState(false)
  const e = doc.extracted
  const others = docs.filter((d) => d.id !== doc.id)

  async function view() {
    const blob = await getFile(doc.id).catch(() => undefined)
    const url = blob ? URL.createObjectURL(blob) : await documentUrl(doc.id)
    if (!url) return alert("Wala ang file sa device na ito o sa server.")
    window.open(url, "_blank", "noopener")
  }

  function saveDetails(form: FormData) {
    const extracted: Extracted = {
      docType: (form.get("docType") as DocType | "unknown") || "unknown",
      ownerName: String(form.get("ownerName") ?? "").trim(),
      businessName: String(form.get("businessName") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      number: String(form.get("number") ?? "").trim(),
      tin: String(form.get("tin") ?? "").trim(),
      issuedOn: String(form.get("issuedOn") ?? ""),
      expiresOn: String(form.get("expiresOn") ?? ""),
      source: "owner",
    }
    const changed = (Object.keys(extracted) as (keyof Extracted)[]).filter((k) => k !== "source" && extracted[k] !== e[k])
    const next = { ...doc, extracted, ownerConfirmed: false }
    const verified = { ...next, ...verifyDocument(next, profile, others) }
    record(verified, [`In-edit ng may-ari: ${changed.join(", ") || "walang binago"}`, verdictEvent(verified)])
    setEditing(false)
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border p-4 text-sm">
      <header className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium">{docName(e.docType)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {doc.fileName} · {(doc.size / 1024).toFixed(0)} KB · {doc.uploadedAt.slice(0, 10)}
            {doc.requirementId && ` · ${getRequirement(doc.requirementId)?.name}`}
          </span>
        </span>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", VERDICT[doc.verdict].tone)}>{VERDICT[doc.verdict].label.split(" · ")[1]}</span>
      </header>

      <ul className="flex flex-col gap-1.5">
        {doc.checks.map((c) => (
          <li key={c.id} className="flex gap-2">
            {CHECK_ICON[c.result]}
            <span>
              <span className="font-medium">{c.label}:</span> {c.detail}
            </span>
          </li>
        ))}
      </ul>
      {doc.ownerConfirmed && <p className="text-xs text-muted-foreground">Kinumpirma mo na tama ito.</p>}

      {editing ? (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            saveDetails(new FormData(ev.currentTarget))
          }}
        >
          <label className="col-span-2 flex flex-col gap-1 text-xs">
            Uri ng dokumento
            <select name="docType" defaultValue={e.docType} className={input}>
              <option value="unknown">Hindi alam</option>
              {(Object.keys(DOC_TYPES) as DocType[]).map((t) => (
                <option key={t} value={t}>
                  {docName(t)}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["ownerName", "Pangalan ng may-ari", "text"],
              ["businessName", "Pangalan ng negosyo", "text"],
              ["number", "Certificate / registration no.", "text"],
              ["tin", "TIN", "text"],
              ["issuedOn", "Petsa ng issue", "date"],
              ["expiresOn", "Expiry", "date"],
            ] as const
          ).map(([k, label, t]) => (
            <label key={k} className="flex flex-col gap-1 text-xs">
              {label}
              <input name={k} type={t} defaultValue={e[k]} className={input} />
            </label>
          ))}
          <label className="col-span-2 flex flex-col gap-1 text-xs">
            Address sa dokumento
            <input name="address" defaultValue={e.address} className={input} />
          </label>
          <div className="col-span-2 flex gap-2">
            <Button type="submit" size="sm">
              I-save at i-verify
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Kanselahin
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={view}>
            Tingnan
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {e.source === "filename" ? "I-type ang detalye" : "I-edit ang detalye"}
          </Button>
          {doc.verdict === "needs_review" && (
            <Button
              size="sm"
              onClick={() => {
                const next = { ...doc, ownerConfirmed: true }
                const verified = { ...next, ...verifyDocument(next, profile, others) }
                record(verified, ["Kinumpirma ng may-ari na tama", verdictEvent(verified)])
              }}
            >
              Tama ito
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              if (!confirm(`Burahin ang ${doc.fileName}?`)) return
              await deleteFile(doc.id)
              update((s) => ({
                docs: s.docs.filter((d) => d.id !== doc.id),
                vaultLog: [{ at: new Date().toISOString(), docId: doc.id, docName: doc.fileName, event: "Binura" }, ...s.vaultLog],
              }))
            }}
          >
            Burahin
          </Button>
        </div>
      )}

      {log.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Kasaysayan ng dokumentong ito</summary>
          <ol className="mt-1 flex flex-col gap-0.5">
            {log.map((l, i) => (
              <li key={i}>
                {l.at.slice(0, 16).replace("T", " ")} — {l.event}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  )
}
