"use client"

import { useRouter } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import { clearFiles } from "./files"
import type { ItemState, Profile, VaultDoc, VaultEvent } from "./types"

// Owner's data lives on their device for now (works offline, nothing leaves
// without the owner acting). ponytail: localStorage only; move to PostgreSQL
// with row-level security + field-level encryption for TIN/ID numbers
// (PRD §11) when accounts and server-side reminders land.

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

const KEY = "hermit:v1"
const SERVER: Saved = { ready: false, profile: null, items: {}, chat: [], lastDiff: null, docs: [], vaultLog: [] }
const listeners = new Set<() => void>()
let cache: Saved | null = null

function read(): Saved {
  if (cache) return cache
  try {
    cache = { ...SERVER, ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), ready: true }
  } catch {
    cache = { ...SERVER, ready: true }
  }
  return cache!
}

export function update(fn: (s: Saved) => Partial<Saved>) {
  cache = { ...read(), ...fn(read()) }
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...cache, ready: undefined }))
  } catch {
    // storage full or blocked: keep the in-memory copy
  }
  listeners.forEach((l) => l())
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  clearFiles().catch(() => {})
  cache = { ...SERVER, ready: true }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useHermit = () => useSyncExternalStore(subscribe, read, () => SERVER)

// For pages that need a finished profile: sends first-timers to onboarding.
export function useProfile() {
  const s = useHermit()
  const router = useRouter()
  useEffect(() => {
    if (s.ready && !s.profile) router.replace("/onboarding")
  }, [s.ready, s.profile, router])
  return s
}
