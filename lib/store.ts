"use client"

import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import {
  appendVaultEvents,
  clearChat,
  currentOwnerId,
  deleteDocument,
  pullState,
  pushOwner,
  saveDocuments,
  type ServerState,
} from "@/app/sync"

import { deleteFile } from "./files"
import {
  editRememberedAnswer,
  emptyFormMemory,
  loadFormMemory,
  memoryKey,
  ownerStateKey,
  persistFormMemory,
  rememberAnswers,
  type FormMemory,
  type ReusableKey,
} from "./form-memory"
import type { Box } from "./fill"
import type { ItemState, Profile, VaultDoc, VaultEvent } from "./types"

// The device is the working copy (instant, works offline on weak signal);
// account/checklist/vault changes are mirrored through app/sync.ts. Reusable
// answers stay local; form edits and signatures live only in this session.
// Local working copy wins ordinary hydration. Explicit restore chooses the server
// only after pending local operations have been acknowledged.

type PendingSync = {
  owner?: number
  documents?: Record<string, number>
  deleted?: Record<string, number>
  events?: VaultEvent[]
  clearChat?: number
}

export type ChatMessage = {
  role: "owner" | "hermit"
  text: string
  sources?: { name: string; url: string; lastVerified: string | null; copiedOn?: string }[]
  formIds?: string[]
  packs?: string[] // document packets Kuya Hermit prepared
  at: string
}

export type Saved = {
  pendingSync?: PendingSync
  syncVersion?: number
  syncError?: string
  ownerId: string | null
  scopeError?: string
  formMemory: FormMemory
  formEdits: Record<string, Record<string, string>> // current session only
  pdfDrafts: Record<string, Box[]> // current session only, including signatures
  ready: boolean // local copy loaded
  synced: boolean // server copy checked (or unavailable)
  profile: Profile | null
  items: Record<string, ItemState>
  chat: ChatMessage[]
  lastDiff: { added: string[]; removed: string[] } | null
  docs: VaultDoc[]
  vaultLog: VaultEvent[] // append-only record of uploads, checks, edits, deletions
}

const SERVER: Saved = {
  ownerId: null,
  formMemory: emptyFormMemory(),
  formEdits: {},
  pdfDrafts: {},
  ready: false,
  synced: false,
  profile: null,
  items: {},
  chat: [],
  lastDiff: null,
  docs: [],
  vaultLog: [],
}
const listeners = new Set<() => void>()
let cache: Saved | null = null
let configuredOwner: string | null | undefined

export const currentStorageKey = () => cache?.ownerId ? ownerStateKey(cache.ownerId) : ""
export const getConfiguredOwner = () => configuredOwner

export function configureOwner(owner: string | null) {
  if (configuredOwner === owner) return
  configuredOwner = owner
  if (cache?.ownerId && cache.ownerId !== owner) cache = null
  listeners.forEach((listener) => listener())
}

function read(): Saved {
  if (cache) return cache
  // Never expose an unscoped device profile while the signed owner is unknown.
  cache = { ...SERVER, ready: true }
  queueMicrotask(hydrate)
  return cache!
}

function commit(next: Saved) {
  cache = next
  try {
    if (next.ownerId) {
      const durable = { ownerId: next.ownerId, profile: next.profile, items: next.items, chat: next.chat, lastDiff: next.lastDiff, docs: next.docs, vaultLog: next.vaultLog, pendingSync: next.pendingSync, syncVersion: next.syncVersion }
      localStorage.setItem(ownerStateKey(next.ownerId), JSON.stringify(durable))
    }
  } catch {
    // Account storage can fail without blocking the current session.
  }
  listeners.forEach((l) => l())
}

let ownerTimer: ReturnType<typeof setTimeout> | undefined
let flushing = false

const hasPending = (s: Saved) => {
  const p = s.pendingSync
  return Boolean(p && (p.owner || p.clearChat || Object.keys(p.documents ?? {}).length || Object.keys(p.deleted ?? {}).length || p.events?.length))
}

// Queue before persisting, so a reload during debounce cannot lose the write.
function queueChanges(prev: Saved, next: Saved) {
  if (!next.ownerId) return
  const version = (prev.syncVersion ?? 0) + 1
  const pending = { ...next.pendingSync }
  if (prev.profile !== next.profile || prev.items !== next.items || prev.lastDiff !== next.lastDiff) pending.owner = version
  if (prev.docs !== next.docs) {
    pending.documents = { ...pending.documents }
    pending.deleted = { ...pending.deleted }
    const before = new Map(prev.docs.map((d) => [d.id, d]))
    for (const d of next.docs.filter((d) => before.get(d.id) !== d)) {
      pending.documents[d.id] = version
      delete pending.deleted[d.id]
    }
    const kept = new Set(next.docs.map((d) => d.id))
    for (const d of prev.docs) if (!kept.has(d.id)) {
      pending.deleted[d.id] = version
      delete pending.documents[d.id]
    }
  }
  if (prev.vaultLog !== next.vaultLog) {
    const known = new Set(prev.vaultLog)
    pending.events = [...(pending.events ?? []), ...next.vaultLog.filter((e) => !known.has(e))]
  }
  if (prev.chat.length && !next.chat.length) pending.clearChat = version
  next.pendingSync = pending
  next.syncVersion = version
}

export async function flushSync() {
  if (flushing || hydrating) return
  const id = read().ownerId
  if (!id) return
  flushing = true
  try {
    while (read().ownerId === id && hasPending(read())) {
      const s = read()
      const pending = s.pendingSync!
      const ack = async (work: Promise<boolean>, clear: (p: PendingSync) => PendingSync) => {
        if ((await work) !== true) throw new Error("Server sync is unavailable.")
        if (read().ownerId === id) commit({ ...read(), pendingSync: clear(read().pendingSync ?? {}), syncError: undefined })
      }
      if (pending.owner) await ack(pushOwner({ profile: s.profile, items: s.items, lastDiff: s.lastDiff }, id), (p) => p.owner === pending.owner ? { ...p, owner: undefined } : p)
      for (const [docId, version] of Object.entries(pending.documents ?? {})) {
        if (read().ownerId !== id) return
        if (read().pendingSync?.documents?.[docId] !== version) continue
        const doc = read().docs.find((d) => d.id === docId)
        if (!doc) {
          if (!read().pendingSync?.documents?.[docId]) continue
          throw new Error("A pending document is missing from the device copy.")
        }
        await ack(saveDocuments([doc], id), (p) => {
          const documents = { ...p.documents }
          if (documents[docId] === version) delete documents[docId]
          return { ...p, documents }
        })
      }
      for (const [docId, version] of Object.entries(pending.deleted ?? {})) {
        if (read().ownerId !== id) return
        if (read().pendingSync?.deleted?.[docId] !== version) continue
        await ack(deleteDocument(docId, id), (p) => {
          const deleted = { ...p.deleted }
          if (deleted[docId] === version) delete deleted[docId]
          return { ...p, deleted }
        })
      }
      const events = pending.events?.slice(0, 100) ?? []
      if (read().ownerId !== id) return
      if (events.length) await ack(appendVaultEvents(events, id), (p) => ({ ...p, events: p.events?.filter((e) => !events.some((sent) => JSON.stringify(sent) === JSON.stringify(e))) }))
      if (pending.clearChat) await ack(clearChat(id), (p) => p.clearChat === pending.clearChat ? { ...p, clearChat: undefined } : p)
    }
  } catch (error) {
    if (read().ownerId === id) commit({ ...read(), syncError: "Changes are kept on this device. Server sync failed; reconnect and retry." })
    console.warn("HERMIT sync failed (kept on device)", error)
  } finally {
    flushing = false
  }
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  const prev = read()
  const patch = fn(prev)
  if (!Object.keys(patch).length) return
  const next = { ...prev, ...patch }
  queueChanges(prev, next)
  commit(next)
  if (hasPending(next)) {
    clearTimeout(ownerTimer)
    ownerTimer = setTimeout(() => void flushSync(), 800)
  }
}

let hydrating = false
export async function hydrate() {
  if (hydrating) return
  hydrating = true
  let id: string
  try {
    id = await currentOwnerId()
  } catch {
    commit({
      ...SERVER,
      ready: true,
      scopeError: "Could not verify your account. Reconnect and retry.",
    })
    hydrating = false
    return
  }
  let local: Saved = { ...SERVER, ownerId: id, ready: true }
  try {
    const stored = JSON.parse(localStorage.getItem(ownerStateKey(id)) ?? "null")
    if (stored?.ownerId === id)
      local = { ...local, ...stored, ownerId: id, formEdits: {}, pdfDrafts: {} }
    local.formMemory = loadFormMemory(localStorage, id)
  } catch {}
  if (cache?.ownerId === id) {
    local.formEdits = cache.formEdits
    local.pdfDrafts = cache.pdfDrafts
  }
  let server: ServerState | null = null
  let syncError: string | undefined
  try {
    server = await pullState(id)
  } catch (e) {
    syncError = "Could not check the server copy. This device's changes are kept; reconnect and retry."
    console.warn("HERMIT: server unavailable, using this device's copy", e)
  }
  const latestId = await currentOwnerId().catch(() => null)
  if (latestId !== id) {
    commit({ ...SERVER, ready: true, scopeError: "Account changed while loading. Retry loading your account." })
    hydrating = false
    return
  }
  if (cache?.ownerId === id) local = { ...local, ...cache, scopeError: undefined }
  // Returning eGovPH user on this device (/egovph/sso switched the owner):
  // their saved data wins over whatever this device had.
  const restoring = typeof location !== "undefined" && new URLSearchParams(location.search).has("restore")
  if (restoring && server && !hasPending(local)) {
    commit({ ...local, ...server, ready: true, synced: true, syncError: undefined })
    history.replaceState(null, "", location.pathname)
    hydrating = false
    return
  }
  if (server?.profile && !local.profile && !hasPending(local)) {
    // New device / cleared browser: restore everything from the server.
    commit({ ...local, ...server, synced: true })
    hydrating = false
    return
  }
  // A missing owner row also needs its first sync; a failed pull is not absence.
  if (local.profile && !server?.profile && !syncError && !hasPending(local)) queueChanges({ ...local, profile: null, docs: [], vaultLog: [] }, local)
  commit({ ...local, synced: true, syncError })
  hydrating = false
  if (!syncError) await flushSync()
  if (restoring && server && !hasPending(read()) && !read().syncError) await hydrate()
}

export function setFormAnswer(formId: string, key: string, value: string) {
  update((s) => ({
    formEdits: {
      ...s.formEdits,
      [formId]: { ...s.formEdits[formId], [key]: value },
    },
  }))
}

async function changeMemory(change: (memory: FormMemory) => FormMemory) {
  const s = read()
  if (
    !s.ownerId ||
    (await currentOwnerId()) !== s.ownerId ||
    read().ownerId !== s.ownerId
  )
    throw new Error("Account changed. Reload before saving.")
  // Read again after awaiting: deletion in another tab must not be resurrected.
  const next = change(loadFormMemory(localStorage, s.ownerId))
  persistFormMemory(localStorage, s.ownerId, next)
  update(() => ({ formMemory: next }))
}

export async function saveFormAnswers(
  values: Record<string, string>,
  consent: boolean,
  sourceForm: string
) {
  if (consent !== true) return
  await changeMemory((memory) =>
    rememberAnswers(memory, consent, values, sourceForm)
  )
}

export const editSavedAnswer = (key: ReusableKey, value: string) =>
  changeMemory((memory) => editRememberedAnswer(memory, key, value))
export const withdrawFormConsent = () => changeMemory(() => emptyFormMemory())

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void hydrate())
  window.addEventListener("storage", (event) => {
    const s = read()
    if (
      s.ownerId &&
      (event.key === memoryKey(s.ownerId) || event.key === null)
    ) {
      update(() => ({ formMemory: loadFormMemory(localStorage, s.ownerId!) }))
    }
  })
  window.addEventListener("focus", async () => {
    const s = read()
    const current = await currentOwnerId().catch(() => null)
    if (s.ownerId && current && current !== s.ownerId) {
      clearTimeout(ownerTimer)
      cache = { ...SERVER, ready: true }
      listeners.forEach((l) => l())
      await hydrate()
    }
  })
}

export function clearAll() {
  clearTimeout(ownerTimer)
  const current = read()
  const id = current.ownerId
  try {
    // Includes form-editor drafts (hermit:fill:*), which can hold a signature.
    for (const k of Object.keys(localStorage)) {
      if (
        k === "hermit:v1" ||
        k.startsWith("hermit:fill:") ||
        (id && (k === ownerStateKey(id) || k === memoryKey(id)))
      )
        localStorage.removeItem(k)
    }
  } catch {}
  for (const doc of current.docs) deleteFile(doc.id).catch(() => {})
  commit({ ...SERVER, ready: true, synced: true })
}

export function subscribeStore(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useHermit = () => useSyncExternalStore(subscribeStore, read, () => SERVER)

// For pages that need a finished profile: sends first-timers to onboarding
// (after checking the server, so a returning owner on a new device isn't).
export function useProfile() {
  const s = useHermit()
  const router = useRouter()
  useEffect(() => {
    if (s.synced && !s.profile && !s.syncError) router.replace("/onboarding")
  }, [s.synced, s.profile, s.syncError, router])
  return s
}
