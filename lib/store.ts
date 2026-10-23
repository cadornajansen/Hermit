"use client"

import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import { storageKeyForAccount } from "./account-storage"
import { normalizeProfile } from "./activities"
import { deleteFile } from "./files"
import type { ItemState, Profile, VaultDoc, VaultEvent } from "./types"

// Roadmaps and files remain on this device. Separate keys prevent the interface
// from showing one account's cached profile to another; they are not a server
// authorization boundary or encrypted storage.

export type ChatMessage = {
  role: "owner" | "hermit"
  text: string
  sources?: { name: string; url: string; lastVerified: string | null }[]
  formIds?: string[]
  at: string
}

export type Saved = {
  ready: boolean
  profile: Profile | null
  items: Record<string, ItemState>
  chat: ChatMessage[]
  lastDiff: { added: string[]; removed: string[] } | null
  docs: VaultDoc[]
  vaultLog: VaultEvent[] // append-only record of uploads, checks, edits, deletions
}

let storageKey = storageKeyForAccount(null)
let configuredAccount: string | null | undefined
const SERVER: Saved = { ready: false, profile: null, items: {}, chat: [], lastDiff: null, docs: [], vaultLog: [] }
const listeners = new Set<() => void>()
let cache: Saved | null = null

export function currentStorageKey(): string {
  return storageKey
}

export function getConfiguredAccount(): string | null | undefined {
  return configuredAccount
}

export function configureAccount(userId: string | null): void {
  if (configuredAccount === userId) return

  storageKey = storageKeyForAccount(userId)
  configuredAccount = userId
  cache = null
  listeners.forEach((listener) => listener())
}

function read(): Saved {
  if (cache) return cache
  try {
    const loaded: Saved = { ...SERVER, ...JSON.parse(localStorage.getItem(storageKey) ?? "{}"), ready: true }
    cache = { ...loaded, profile: loaded.profile ? normalizeProfile(loaded.profile) : null }
  } catch {
    cache = { ...SERVER, ready: true }
  }
  return cache!
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  cache = { ...read(), ...fn(read()) }
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...cache, ready: undefined }))
  } catch {
    // storage full or blocked: keep the in-memory copy
  }
  listeners.forEach((l) => l())
}

export function clearAll() {
  const documentIds = read().docs.map((doc) => doc.id)
  try {
    localStorage.removeItem(storageKey)
  } catch {}
  Promise.all(documentIds.map((id) => deleteFile(id))).catch(() => {})
  cache = { ...SERVER, ready: true }
  listeners.forEach((l) => l())
}

export function subscribeStore(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useHermit = () => useSyncExternalStore(subscribeStore, read, () => SERVER)

// For pages that need a finished profile: sends first-timers to onboarding.
export function useProfile() {
  const s = useHermit()
  const router = useRouter()
  useEffect(() => {
    if (s.ready && !s.profile) router.replace("/onboarding")
  }, [s.ready, s.profile, router])
  return s
}
