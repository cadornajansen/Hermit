"use client"

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleX,
  FileText,
  FileUp,
  FolderOpen,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { useId, useRef, useState, useTransition, type RefObject } from "react"

import { readDocument } from "@/app/actions"
import { documentUrl } from "@/app/sync"
import { DocumentDeleteConfirmation } from "@/components/document-delete-confirmation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DOCUMENT_ACCEPT, documentFileError } from "@/lib/document-upload"
import { buildChecklist, getRequirement } from "@/lib/engine"
import { deleteFile, getFile, putFile, sha256 } from "@/lib/files"
import {
  currentStorageKey,
  update,
  useProfile,
  type Saved,
} from "@/lib/store"
import type { DocType, Extracted, Profile, VaultDoc } from "@/lib/types"
import {
  coverage,
  DOC_TYPES,
  docName,
  REQUIREMENT_DOCS,
  verifyDocument,
} from "@/lib/vault"

export const VERDICT = {
  verified: { label: "Checked", tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", icon: CheckCircle2 },
  needs_review: { label: "Needs review", tone: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200", icon: CircleAlert },
  rejected: { label: "Fix needed", tone: "bg-destructive/10 text-destructive", icon: CircleX },
} as const

const CHECK_ICON = { pass: CheckCircle2, warn: CircleAlert, fail: CircleX }
type DocumentFilter = "all" | VaultDoc["verdict"]

function DocumentStatus({ doc }: { doc: VaultDoc }) {
  const status = VERDICT[doc.verdict]
  const Icon = status.icon
  return (
    <Badge variant="secondary" className={`h-auto min-h-6 rounded-md px-2 py-1 ${status.tone}`}>
      <Icon aria-hidden="true" />
      {status.label}
    </Badge>
  )
}

function FileMark({ image = false }: { image?: boolean }) {
  const Icon = image ? ImageIcon : FileText
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-secondary text-secondary-foreground"
      aria-hidden="true"
    >
      <Icon className="size-5" />
    </span>
  )
}

function DocumentSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
        items={options}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          sideOffset={8}
          alignItemWithTrigger={false}
        >
          <SelectGroup>
            {Object.entries(options).map(([key, text]) => (
              <SelectItem
                key={key}
                value={key}
                className="[&>span:first-child]:min-w-0 [&>span:first-child]:shrink [&>span:first-child]:whitespace-normal"
              >
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function isCurrentDocumentScope(scope: string): boolean {
  return Boolean(scope) && currentStorageKey() === scope
}

// Readable identity evidence may supply metadata, but never proves agency issuance.
function record(doc: VaultDoc, events: string[], scope = currentStorageKey()): void {
  if (!isCurrentDocumentScope(scope)) return
  update((s) => {
    const at = new Date().toISOString()
    const patch: Partial<Saved> = {
      docs: [doc, ...s.docs.filter((d) => d.id !== doc.id)],
    }
    const e = doc.extracted
    if (doc.verdict === "verified" && s.profile && e.docType !== "unknown") {
      const key = DOC_TYPES[e.docType].formKey
      const extra = { ...s.profile.extra }
      if (e.tin) extra.tin = e.tin
      if (key && key !== "tin" && e.number) extra[key] = e.number
      if (JSON.stringify(extra) !== JSON.stringify(s.profile.extra)) {
        patch.profile = { ...s.profile, extra }
        events.push("Saved numbers for form prefill")
      }
    }
    const log = events.map((event) => ({
      at,
      docId: doc.id,
      docName: doc.fileName,
      event,
    }))
    return { ...patch, vaultLog: [...log, ...s.vaultLog].slice(0, 500) }
  })
}

const verdictEvent = (doc: VaultDoc) => {
  const problems = doc.checks.filter((c) => c.result !== "pass").length
  return `Check: ${VERDICT[doc.verdict].label}${problems ? ` (${problems} to review)` : ""}`
}

export function Vault(props: {
  initialRequirement: string
  initialType: string
}) {
  const state = useProfile()
  if (!state.profile) return null
  return (
    <DocumentLibrary
      key={`${currentStorageKey()}:${props.initialRequirement}:${props.initialType}`}
      {...props}
      profile={state.profile}
      items={state.items}
      docs={state.docs}
      vaultLog={state.vaultLog}
    />
  )
}

function DocumentLibrary({
  profile,
  items,
  docs,
  vaultLog,
  initialRequirement,
  initialType,
}: {
  profile: Profile
  items: Saved["items"]
  docs: VaultDoc[]
  vaultLog: Saved["vaultLog"]
  initialRequirement: string
  initialType: string
}) {
  const [reqId, setReqId] = useState(initialRequirement)
  const [type, setType] = useState<DocType | "">(
    initialType in DOC_TYPES ? (initialType as DocType) : ""
  )
  const [uploadOpen, setUploadOpen] = useState(
    Boolean(initialRequirement || initialType)
  )
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState<DocumentFilter>("all")
  const [selectedId, setSelectedId] = useState<string>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const [pending, start] = useTransition()
  const busy = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadButton = useRef<HTMLButtonElement>(null)
  const detailTrigger = useRef<HTMLElement | null>(null)
  const uploadTitle = useRef<HTMLHeadingElement>(null)

  const checklist = buildChecklist(profile, items).filter(
    (item) => REQUIREMENT_DOCS[item.id]
  )
  const spec = REQUIREMENT_DOCS[reqId]
  const slotTypes = spec
    ? [
        ...new Set([
          ...spec.needs.flat(),
          ...(spec.issues ? [spec.issues] : []),
        ]),
      ]
    : []
  const missing = checklist.flatMap((item) =>
    coverage(item.id, docs)!
      .needs.filter((slot) => slot.doc?.verdict !== "verified")
      .map((slot) => ({ item, slot }))
  )
  const counts = { all: docs.length, verified: 0, needs_review: 0, rejected: 0 }
  for (const doc of docs) counts[doc.verdict]++
  const visible =
    filter === "all" ? docs : docs.filter((doc) => doc.verdict === filter)
  const selected = docs.find((doc) => doc.id === selectedId)

  function chooseFiles(files: File[]): void {
    if (busy.current) return
    if (files.length !== 1) {
      setError("Choose one file at a time.")
      return
    }
    const problem = documentFileError(files[0])
    if (problem) {
      setError(problem)
      return
    }
    setFile(files[0])
    setError("")
    if (fileRef.current) fileRef.current.value = ""
  }

  function upload(): void {
    if (!file || busy.current) return
    const problem = documentFileError(file)
    if (problem) {
      setError(problem)
      return
    }
    const scope = currentStorageKey()
    if (!isCurrentDocumentScope(scope)) return
    const chosenFile = file
    busy.current = true
    setError("")
    start(async () => {
      const id = crypto.randomUUID()
      try {
        const [hash] = await Promise.all([
          sha256(chosenFile),
          putFile(id, chosenFile),
        ])
        if (!isCurrentDocumentScope(scope)) {
          await deleteFile(id)
          return
        }
        const fd = new FormData()
        fd.set("file", chosenFile)
        fd.set("id", id)
        const result = await readDocument(fd)
        if (!isCurrentDocumentScope(scope)) {
          await deleteFile(id)
          return
        }
        if (!result.ok) {
          await deleteFile(id)
          setError(result.error)
          return
        }
        const extracted: Extracted =
          result.extracted.docType === "unknown" && type
            ? { ...result.extracted, docType: type }
            : result.extracted
        const base = {
          id,
          sha256: hash,
          expectedTypes: type ? [type] : slotTypes,
          extracted,
          ownerConfirmed: false,
        }
        const doc: VaultDoc = {
          ...base,
          ...verifyDocument(base, profile, docs),
          fileName: chosenFile.name,
          mime: chosenFile.type,
          size: chosenFile.size,
          uploadedAt: new Date().toISOString(),
          requirementId: reqId || undefined,
          storagePath: result.storagePath,
          extracted: { ...extracted, original: { ...result.extracted }, ...(result.extracted.docType !== extracted.docType ? { corrections: { docType: extracted.docType } } : {}) },
        }
        record(
          doc,
          [
            `Uploaded${reqId ? ` for ${getRequirement(reqId)?.name}` : ""}`,
            result.reader
              ? `Read by ${result.reader}: ${docName(extracted.docType)}`
              : result.limited
                ? "AI limit reached. Review the detected details."
                : "Detected from filename. Review the details.",
            verdictEvent(doc),
          ],
          scope
        )
        setFile(null)
        setUploadOpen(false)
        setFilter("all")
        detailTrigger.current = uploadButton.current
        setSelectedId(id)
        setDetailOpen(false)
        setNotice("Document added.")
      } catch {
        await deleteFile(id).catch(() => undefined)
        if (isCurrentDocumentScope(scope))
          setError("Could not read this file. Try again.")
      } finally {
        busy.current = false
      }
    })
  }

  function recheckAll(): void {
    for (const doc of docs) {
      const next = { ...doc, ...verifyDocument(doc, profile, docs) }
      if (next.verdict !== doc.verdict)
        record(next, [
          `Rechecked: ${VERDICT[doc.verdict].label} → ${VERDICT[next.verdict].label}`,
        ])
    }
    setNotice("Checks updated.")
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-xs text-muted-foreground">
            {docs.length} {docs.length === 1 ? "document" : "documents"} on file
          </p>
        </div>
        <Button ref={uploadButton} onClick={() => setUploadOpen(true)}>
          <FileUp data-icon="inline-start" />
          Upload document
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <RadioGroup
          value={filter}
          onValueChange={(next) => setFilter(next as DocumentFilter)}
          aria-label="Filter documents"
          className="flex w-auto flex-wrap gap-1 rounded-lg bg-card p-1 shadow-sm"
        >
          {(["all", "verified", "needs_review", "rejected"] as const).map(
            (value) => (
              <label
                key={value}
                className="relative flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] px-3 text-sm text-muted-foreground has-data-checked:bg-muted has-data-checked:font-medium has-data-checked:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              >
                <RadioGroupItem value={value} className="sr-only" />
                {value === "all" ? "All" : VERDICT[value].label}
                <span className="text-xs tabular-nums">{counts[value]}</span>
              </label>
            )
          )}
        </RadioGroup>
        {docs.length > 0 && (
          <Button variant="ghost" onClick={recheckAll}>
            <RefreshCw data-icon="inline-start" />
            Recheck all
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      <section
        aria-label="Documents on file"
        className="overflow-hidden rounded-lg bg-card shadow-sm"
      >
        {visible.length ? (
          <ul className="divide-y divide-border/50">
            {visible.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:px-5"
              >
                <FileMark image={doc.mime.startsWith("image/")} />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-medium break-words">
                    {docName(doc.extracted.docType)}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={doc.fileName}
                  >
                    {doc.fileName}
                  </p>
                  {doc.requirementId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRequirement(doc.requirementId)?.name}
                    </p>
                  )}
                </div>
                <DocumentStatus doc={doc} />
                <Button
                  variant="outline"
                  onClick={(event) => {
                    detailTrigger.current = event.currentTarget
                    setSelectedId(doc.id)
                    setDetailOpen(true)
                  }}
                >
                  View details
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="min-h-64 px-6 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle>
                {docs.length
                  ? "No documents here"
                  : "A place for your paperwork"}
              </EmptyTitle>
              <EmptyDescription>
                {docs.length
                  ? "Choose another status to see your files."
                  : "Add a permit, certificate or registration."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Checks may need review. Stored on this device; private cloud copy when
        connected.
      </p>

      {missing.length > 0 && (
        <details className="group rounded-lg bg-card px-5 py-2 shadow-sm">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-medium">
            Still needed
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {missing.length}
            </span>
            <ChevronDown
              className="size-4 text-muted-foreground group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="divide-y divide-border/50">
            {missing.map(({ item, slot }) => (
              <li
                key={item.id + slot.types.join()}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {slot.types.map(docName).join(" / ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.name}
                    {slot.doc ? ` · ${VERDICT[slot.doc.verdict].label}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReqId(item.id)
                    setType(slot.types.length === 1 ? slot.types[0] : "")
                    setUploadOpen(true)
                  }}
                >
                  Upload
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {vaultLog.length > 0 && (
        <details className="group rounded-lg bg-card px-5 py-2 text-sm shadow-sm">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-medium">
            Activity history
            <ChevronDown
              className="ml-auto size-4 text-muted-foreground group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ol className="flex flex-col gap-3 py-3">
            {vaultLog.slice(0, 100).map((event, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 text-xs sm:flex-row sm:gap-4"
              >
                <time className="shrink-0 text-muted-foreground">
                  {new Date(event.at).toLocaleString("en-PH", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
                <span className="break-words">
                  <span className="font-medium">{event.docName}</span> ·{" "}
                  {event.event}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <Dialog
        open={uploadOpen}
        onOpenChange={(next) => {
          if (!busy.current) setUploadOpen(next)
        }}
        disablePointerDismissal={pending}
      >
        <DialogContent
          showCloseButton={!pending}
          initialFocus={uploadTitle}
          finalFocus={uploadButton}
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px] [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent"
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pr-16 pb-1">
            <DialogTitle
              ref={uploadTitle}
              tabIndex={-1}
              className="text-lg font-semibold outline-none"
            >
              Upload document
            </DialogTitle>
            <DialogDescription>PDF or image · Up to 10 MB</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <form
              id="document-upload"
              onSubmit={(event) => {
                event.preventDefault()
                upload()
              }}
            >
              <FieldGroup className="gap-5">
                <div
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (!pending) setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    chooseFiles(Array.from(event.dataTransfer.files))
                  }}
                  data-dragging={dragging || undefined}
                  className="flex flex-col items-center gap-3 rounded-lg bg-muted p-6 text-center data-dragging:bg-secondary data-dragging:outline-2 data-dragging:outline-ring"
                >
                  {file ? (
                    <>
                      <FileMark image={file.type.startsWith("image/")} />
                      <div className="max-w-full min-w-0">
                        <p className="text-sm font-medium break-all">
                          {file.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(0)} KB · Ready to check
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileUp
                        className="size-8 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium">Drop your file here</p>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={DOCUMENT_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Choose document file"
                    onChange={(event) => {
                      if (event.target.files?.length)
                        chooseFiles(Array.from(event.target.files))
                    }}
                    disabled={pending}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => fileRef.current?.click()}
                    >
                      {file ? "Choose another" : "Choose file"}
                    </Button>
                    {file && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove selected file"
                        disabled={pending}
                        onClick={() => {
                          setFile(null)
                          setError("")
                        }}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </div>
                <DocumentSelect
                  label="Requirement"
                  value={reqId}
                  options={{
                    "": "General",
                    ...Object.fromEntries(
                      checklist.map((item) => [item.id, item.name])
                    ),
                  }}
                  onChange={(next) => {
                    setReqId(next)
                    setType("")
                  }}
                  disabled={pending}
                />
                <DocumentSelect
                  label="Document type"
                  value={type}
                  options={{
                    "": "Detect automatically",
                    ...Object.fromEntries(
                      (slotTypes.length
                        ? slotTypes
                        : (Object.keys(DOC_TYPES) as DocType[])
                      ).map((docType) => [docType, docName(docType)])
                    ),
                  }}
                  onChange={(next) => setType(next as DocType | "")}
                  disabled={pending}
                />
                {error && (
                  <p
                    role="alert"
                    className="rounded-[12px] bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}
              </FieldGroup>
            </form>
          </div>
          <DialogFooter className="shrink-0 bg-muted/40 px-6 py-4">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="document-upload"
              disabled={!file || pending}
              aria-busy={pending}
            >
              {pending ? (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              ) : (
                <FileUp data-icon="inline-start" />
              )}
              {pending ? "Checking…" : "Upload and check"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {selected && (
        <DocumentDetails
          key={selected.id}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          doc={selected}
          profile={profile}
          docs={docs}
          log={vaultLog.filter((entry) => entry.docId === selected.id)}
          finalFocus={detailTrigger}
          onDeleted={() => {
            setDetailOpen(false)
            setSelectedId(undefined)
            uploadButton.current?.focus()
          }}
        />
      )}
    </div>
  )
}

function DocumentDetails({
  open,
  onOpenChange,
  doc,
  profile,
  docs,
  log,
  finalFocus,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: VaultDoc
  profile: Profile
  docs: VaultDoc[]
  log: Saved["vaultLog"]
  finalFocus: RefObject<HTMLElement | null>
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.extracted)
  const [error, setError] = useState("")
  const [viewing, startView] = useTransition()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const formId = useId()
  const others = docs.filter((other) => other.id !== doc.id)
  const problems = doc.checks.filter((check) => check.result !== "pass")
  const failure = doc.checks.find((check) => check.result === "fail")

  function saveDetails(): void {
    setError("")
    try {
      const extracted: Extracted = {
        ...draft,
        ownerName: draft.ownerName.trim(),
        businessName: draft.businessName.trim(),
        address: draft.address.trim(),
        number: draft.number.trim(),
        tin: draft.tin.trim(),
        source: "owner",
      }
      const changed = (Object.keys(extracted) as (keyof Extracted)[]).filter(
        (key) => !["source", "original", "corrections"].includes(key) && extracted[key] !== doc.extracted[key]
      )
      const original = { ...doc.extracted }
      delete original.original
      delete original.corrections
      extracted.original = doc.extracted.original ?? original
      extracted.corrections = { ...doc.extracted.corrections, ...Object.fromEntries(changed.map((key) => [key, extracted[key]])) }
      const next = { ...doc, extracted, ownerConfirmed: false }
      const checked = { ...next, ...verifyDocument(next, profile, others) }
      record(checked, [
        `Owner edited: ${changed.join(", ") || "no changes"}`,
        verdictEvent(checked),
      ])
      setEditing(false)
    } catch {
      setError("Could not save these details. Your edits are still here.")
    }
  }

  function view(): void {
    const scope = currentStorageKey()
    setError("")
    startView(async () => {
      try {
        const blob = await getFile(doc.id).catch(() => undefined)
        if (!isCurrentDocumentScope(scope)) return
        const remote = !blob ? await documentUrl(doc.id) : null
        if (!isCurrentDocumentScope(scope)) return
        const url = blob ? URL.createObjectURL(blob) : remote
        if (!url) {
          setError("File unavailable on this device or the server.")
          return
        }
        window.open(url, "_blank", "noopener")
        if (blob) setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch {
        if (isCurrentDocumentScope(scope))
          setError("Could not open this file. Try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={titleRef}
        finalFocus={finalFocus}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[720px] [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent"
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pr-16 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-semibold outline-none"
            >
              {editing ? "Edit document" : docName(doc.extracted.docType)}
            </DialogTitle>
            <DocumentStatus doc={doc} />
          </div>
          <DialogDescription className="text-xs break-all">
            {doc.fileName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-5">
          {failure && (
            <p
              role="alert"
              className="rounded-[12px] bg-destructive/10 p-3 text-sm text-destructive"
            >
              {failure.detail}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-[12px] bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {editing ? (
            <form
              id={formId}
              onSubmit={(event) => {
                event.preventDefault()
                saveDetails()
              }}
            >
              <FieldGroup className="gap-6">
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Registration</h3>
                  <DocumentSelect
                    label="Document type"
                    value={draft.docType}
                    options={{
                      unknown: "Unknown",
                      ...Object.fromEntries(
                        Object.keys(DOC_TYPES).map((key) => [
                          key,
                          docName(key as DocType),
                        ])
                      ),
                    }}
                    onChange={(next) =>
                      setDraft((current) => ({
                        ...current,
                        docType: next as Extracted["docType"],
                      }))
                    }
                  />
                </section>
                {[
                  {
                    title: "Names",
                    fields: [
                      ["ownerName", "Owner name", "text"],
                      ["businessName", "Business name", "text"],
                    ],
                  },
                  {
                    title: "Document details",
                    fields: [
                      ["number", "Registration number", "text"],
                      ["tin", "TIN", "text"],
                      ["issuedOn", "Issue date", "date"],
                      ["expiresOn", "Expiry date", "date"],
                      ["address", "Address", "text"],
                    ],
                  },
                ].map((group) => (
                  <section key={group.title} className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                      {group.fields.map(([key, label, inputType]) => (
                        <Field
                          key={key}
                          className={
                            key === "address" ? "gap-2 sm:col-span-2" : "gap-2"
                          }
                        >
                          <FieldLabel htmlFor={`${formId}-${key}`}>
                            {label}
                          </FieldLabel>
                          <Input
                            id={`${formId}-${key}`}
                            type={inputType}
                            value={String(draft[key as keyof Extracted] ?? "")}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      ))}
                    </FieldGroup>
                  </section>
                ))}
              </FieldGroup>
            </form>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-[12px] bg-muted/60 p-4 text-sm">
                {[
                  [
                    "Requirement",
                    doc.requirementId
                      ? getRequirement(doc.requirementId)?.name
                      : "General",
                  ],
                  [
                    "Uploaded",
                    new Date(doc.uploadedAt).toLocaleDateString("en-PH"),
                  ],
                  ["Owner", doc.extracted.ownerName],
                  ["Business", doc.extracted.businessName],
                  ["Registration number", doc.extracted.number],
                  ["TIN", doc.extracted.tin],
                  ["Issued", doc.extracted.issuedOn],
                  ["Expires", doc.extracted.expiresOn],
                  ["Address", doc.extracted.address],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className={
                        label === "Requirement" || label === "Address"
                          ? "col-span-2"
                          : ""
                      }
                    >
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
              {doc.ownerConfirmed && (
                <p className="text-xs text-muted-foreground">
                  Confirmed by you.
                </p>
              )}
              <details className="group rounded-[12px] bg-muted/50 px-4">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-medium">
                  Document checks
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {problems.length
                      ? `${problems.length} to review`
                      : "All passed"}
                  </span>
                  <ChevronDown
                    className="size-4 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <ul className="flex flex-col gap-3 pb-4">
                  {doc.checks.map((check) => {
                    const Icon = CHECK_ICON[check.result]
                    return (
                      <li key={check.id} className="flex gap-2 text-sm">
                        <Icon
                          className={`mt-0.5 size-4 shrink-0 ${check.result === "fail" ? "text-destructive" : "text-muted-foreground"}`}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium">{check.label}</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {check.detail}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </details>
              <p className="text-xs text-muted-foreground">
                Application completion / official issuance: unverified. After the agency issues your document, update its checklist status separately.
              </p>
              {log.length > 0 && (
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                    History
                  </summary>
                  <ol className="flex flex-col gap-3 pb-2">
                    {log.map((entry, index) => (
                      <li key={index} className="text-xs">
                        <time className="text-muted-foreground">
                          {new Date(entry.at).toLocaleString("en-PH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                        <p className="mt-1 break-words">{entry.event}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-row flex-wrap bg-muted/40 px-6 py-4">
          {editing ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setDraft(doc.extracted)
                  setError("")
                }}
              >
                Cancel edit
              </Button>
              <Button type="submit" form={formId}>
                Save and check
              </Button>
            </>
          ) : (
            <>
              <DocumentDeleteConfirmation
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-auto text-destructive"
                    aria-label="Delete document"
                  >
                    <Trash2 />
                  </Button>
                }
                title="Delete document?"
                description={`${doc.fileName} will be removed. Recorded task progress stays unchanged.`}
                actionLabel="Delete document"
                pendingLabel="Deleting…"
                errorMessage="Could not delete this document. Try again."
                onConfirm={async () => {
                  const scope = currentStorageKey()
                  await deleteFile(doc.id)
                  if (!isCurrentDocumentScope(scope)) return
                  update(
                    (state) => ({
                      docs: state.docs.filter((entry) => entry.id !== doc.id),
                      vaultLog: [
                        {
                          at: new Date().toISOString(),
                          docId: doc.id,
                          docName: doc.fileName,
                          event: "Deleted",
                        },
                        ...state.vaultLog,
                      ],
                    })
                  )
                  onDeleted()
                }}
              />
              <Button variant="outline" onClick={view} disabled={viewing}>
                {viewing ? "Opening…" : "View file"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true)
                  setError("")
                }}
              >
                {doc.extracted.source === "filename"
                  ? "Enter details"
                  : "Edit details"}
              </Button>
              {doc.verdict === "needs_review" && (
                <Button
                  onClick={() => {
                    try {
                      const next = { ...doc, ownerConfirmed: true }
                      const checked = {
                        ...next,
                        ...verifyDocument(next, profile, others),
                      }
                      record(checked, [
                        "Owner confirmed details",
                        verdictEvent(checked),
                      ])
                    } catch {
                      setError("Could not confirm these details. Try again.")
                    }
                  }}
                >
                  Confirm details
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
