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
// ponytail: last-write-wins from this device; changes made while offline only
// re-sync for profile/checklist (docs and log entries are sent once). Add a
// pending-ops queue if owners start using several devices.

export type ChatMessage = {
  role: "owner" | "hermit"
  text: string
  sources?: { name: string; url: string; lastVerified: string | null; copiedOn?: string }[]
  formIds?: string[]
  packs?: string[] // document packets Kuya Hermit prepared
  at: string
}

export type Saved = {
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
      const durable = { ownerId: next.ownerId, profile: next.profile, items: next.items, chat: next.chat, lastDiff: next.lastDiff, docs: next.docs, vaultLog: next.vaultLog }
      localStorage.setItem(ownerStateKey(next.ownerId), JSON.stringify(durable))
    }
  } catch {
    // Account storage can fail without blocking the current session.
  }
  listeners.forEach((l) => l())
}

const quiet = (p: Promise<unknown>) => p.catch((e) => console.warn("HERMIT sync failed (kept on device)", e))

let ownerTimer: ReturnType<typeof setTimeout> | undefined

// Mirror what changed to the server.
function push(prev: Saved, next: Saved) {
  if (!next.ownerId) return
  const id = next.ownerId
  if (
    prev.profile !== next.profile || prev.items !== next.items || prev.lastDiff !== next.lastDiff
  ) {
    clearTimeout(ownerTimer)
    ownerTimer = setTimeout(() => {
      const s = read()
      if (s.profile && s.ownerId === id)
        quiet(
          pushOwner(
            { profile: s.profile, items: s.items, lastDiff: s.lastDiff },
            id
          )
        )
    }, 800)
  }
  if (prev.docs !== next.docs) {
    const before = new Map(prev.docs.map((d) => [d.id, d]))
    const changed = next.docs.filter((d) => before.get(d.id) !== d)
    if (changed.length) quiet(saveDocuments(changed, id))
    const kept = new Set(next.docs.map((d) => d.id))
    for (const d of prev.docs)
      if (!kept.has(d.id)) quiet(deleteDocument(d.id, id))
  }
  if (prev.vaultLog !== next.vaultLog) {
    const known = new Set(prev.vaultLog)
    const added = next.vaultLog.filter((e) => !known.has(e))
    if (added.length) quiet(appendVaultEvents(added, id))
  }
  if (prev.chat.length && !next.chat.length) quiet(clearChat(id))
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  const prev = read()
  const patch = fn(prev)
  if (!Object.keys(patch).length) return
  const next = { ...prev, ...patch }
  commit(next)
  push(prev, next)
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
  try {
    server = await pullState(id)
  } catch (e) {
    console.warn("HERMIT: server unavailable, using this device's copy", e)
  }
  const latestId = await currentOwnerId().catch(() => null)
  if (latestId && latestId !== id) {
    commit({ ...SERVER, ready: true, scopeError: "Account changed while loading. Retry loading your account." })
    hydrating = false
    return
  }
  // Returning eGovPH user on this device (/egovph/sso switched the owner):
  // their saved data wins over whatever this device had.
  if (
    typeof location !== "undefined" && new URLSearchParams(location.search).has("restore")
  ) {
    commit({ ...local, ...(server ?? {}), ready: true, synced: true })
    history.replaceState(null, "", location.pathname)
    hydrating = false
    return
  }
  if (server?.profile && !local.profile) {
    // New device / cleared browser: restore everything from the server.
    commit({ ...local, ...server, synced: true })
    hydrating = false
    return
  }
  commit({ ...local, synced: true })
  hydrating = false
  if (local.profile && !server?.profile) {
    // First sync for data created before the backend existed.
    quiet(
      pushOwner(
        { profile: local.profile, items: local.items, lastDiff: local.lastDiff },
        id
      )
    )
    if (local.docs.length) quiet(saveDocuments(local.docs, id))
    if (local.vaultLog.length)
      quiet(appendVaultEvents(local.vaultLog.slice(0, 100), id))
  }
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

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useHermit = () => useSyncExternalStore(subscribe, read, () => SERVER)

// For pages that need a finished profile: sends first-timers to onboarding
// (after checking the server, so a returning owner on a new device isn't).
export function useProfile() {
  const s = useHermit()
  const router = useRouter()
  useEffect(() => {
    if (s.synced && !s.profile) router.replace("/onboarding")
  }, [s.synced, s.profile, router])
  return s
}
