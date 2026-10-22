"use client"

import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import {
  appendVaultEvents,
  clearChat,
  deleteDocument,
  pullState,
  pushOwner,
  saveDocuments,
  type ServerState,
} from "@/app/sync"

import { clearFiles } from "./files"
import type { ItemState, Profile, VaultDoc, VaultEvent } from "./types"

// The device is the working copy (instant, works offline on weak signal);
// every change is mirrored to Supabase through app/sync.ts, and a fresh device
// (or cleared browser) is restored from it.
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
  ready: boolean // local copy loaded
  synced: boolean // server copy checked (or unavailable)
  profile: Profile | null
  items: Record<string, ItemState>
  chat: ChatMessage[]
  lastDiff: { added: string[]; removed: string[] } | null
  docs: VaultDoc[]
  vaultLog: VaultEvent[] // append-only record of uploads, checks, edits, deletions
}

const KEY = "hermit:v1"
const SERVER: Saved = { ready: false, synced: false, profile: null, items: {}, chat: [], lastDiff: null, docs: [], vaultLog: [] }
const listeners = new Set<() => void>()
let cache: Saved | null = null

function read(): Saved {
  if (cache) return cache
  try {
    cache = { ...SERVER, ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), ready: true, synced: false }
  } catch {
    cache = { ...SERVER, ready: true }
  }
  queueMicrotask(hydrate)
  return cache!
}

function commit(next: Saved) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...cache, ready: undefined, synced: undefined }))
  } catch {
    // storage full or blocked: keep the in-memory copy
  }
  listeners.forEach((l) => l())
}

const quiet = (p: Promise<unknown>) => p.catch((e) => console.warn("HERMIT sync failed (kept on device)", e))

let ownerTimer: ReturnType<typeof setTimeout> | undefined

// Mirror what changed to the server.
function push(prev: Saved, next: Saved) {
  if (prev.profile !== next.profile || prev.items !== next.items || prev.lastDiff !== next.lastDiff) {
    clearTimeout(ownerTimer)
    ownerTimer = setTimeout(() => {
      const s = read()
      if (s.profile) quiet(pushOwner({ profile: s.profile, items: s.items, lastDiff: s.lastDiff }))
    }, 800)
  }
  if (prev.docs !== next.docs) {
    const before = new Map(prev.docs.map((d) => [d.id, d]))
    const changed = next.docs.filter((d) => before.get(d.id) !== d)
    if (changed.length) quiet(saveDocuments(changed))
    const kept = new Set(next.docs.map((d) => d.id))
    for (const d of prev.docs) if (!kept.has(d.id)) quiet(deleteDocument(d.id))
  }
  if (prev.vaultLog !== next.vaultLog) {
    const known = new Set(prev.vaultLog)
    const added = next.vaultLog.filter((e) => !known.has(e))
    if (added.length) quiet(appendVaultEvents(added))
  }
  if (prev.chat.length && !next.chat.length) quiet(clearChat())
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  const prev = read()
  const next = { ...prev, ...fn(prev) }
  commit(next)
  push(prev, next)
}

let hydrating = false
async function hydrate() {
  if (hydrating) return
  hydrating = true
  let server: ServerState | null = null
  try {
    server = await pullState()
  } catch (e) {
    console.warn("HERMIT: server unavailable, using this device's copy", e)
  }
  const local = read()
  // Returning eGovPH user on this device (/egovph/sso switched the owner):
  // their saved data wins over whatever this device had.
  if (typeof location !== "undefined" && new URLSearchParams(location.search).has("restore")) {
    commit({ ...SERVER, ...(server ?? {}), ready: true, synced: true })
    history.replaceState(null, "", location.pathname)
    return
  }
  if (server?.profile && !local.profile) {
    // New device / cleared browser: restore everything from the server.
    commit({ ...local, ...server, synced: true })
    return
  }
  commit({ ...local, synced: true })
  if (local.profile && !server?.profile) {
    // First sync for data created before the backend existed.
    quiet(pushOwner({ profile: local.profile, items: local.items, lastDiff: local.lastDiff }))
    if (local.docs.length) quiet(saveDocuments(local.docs))
    if (local.vaultLog.length) quiet(appendVaultEvents(local.vaultLog.slice(0, 100)))
  }
}

export function clearAll() {
  try {
    // Includes form-editor drafts (hermit:fill:*), which can hold a signature.
    for (const k of Object.keys(localStorage)) if (k.startsWith("hermit:")) localStorage.removeItem(k)
  } catch {}
  clearFiles().catch(() => {})
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
