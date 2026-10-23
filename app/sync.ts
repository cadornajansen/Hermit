"use server"

import { BUCKET, db } from "@/lib/db"
import { clearSession, ownerId } from "@/lib/session"
import type { ChatMessage } from "@/lib/store"
import type { ItemState, Profile, VaultDoc, VaultEvent } from "@/lib/types"

// Device ⇄ Supabase sync. The device stays the working copy (works offline,
// fast on weak signal); the server keeps a durable copy keyed by the signed
// owner cookie. All of these are public POST endpoints: validate everything
// and always scope by the owner id from the cookie, never from the payload.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERDICTS = new Set(["verified", "needs_review", "rejected"])

function checked(result: { error: unknown }) {
  if (result.error) throw new Error("Could not sync account data. Changes remain on this device.")
}

function capped<T>(value: T, maxBytes: number): T {
  if (JSON.stringify(value ?? null).length > maxBytes) throw new Error("Payload too large")
  return value
}

async function owner(expectedOwnerId: string) {
  const id = await ownerId()
  if (!id || id !== expectedOwnerId)
    throw new Error("Account changed. Reload before saving.")
  const sb = db()
  if (!sb) return null
  checked(await sb.from("owners").upsert({ id }, { onConflict: "id", ignoreDuplicates: true }))
  return { sb, id }
}

export async function currentOwnerId(): Promise<string> {
  const id = await ownerId(true)
  if (!id) throw new Error("Could not resolve account")
  return id
}

export type ServerState = {
  profile: Profile | null
  items: Record<string, ItemState>
  lastDiff: { added: string[]; removed: string[] } | null
  docs: VaultDoc[]
  vaultLog: VaultEvent[]
  chat: ChatMessage[]
}

export async function pullState(
  expectedOwnerId: string
): Promise<ServerState | null> {
  const sb = db()
  const id = await ownerId()
  if (id !== expectedOwnerId)
    throw new Error("Account changed. Reload before saving.")
  if (!sb || !id) return null
  const [o, d, e, c] = await Promise.all([
    sb.from("owners").select("profile, items, last_diff").eq("id", id).maybeSingle(),
    sb.from("documents").select("*").eq("owner_id", id).order("uploaded_at", { ascending: false }),
    sb.from("vault_events").select("doc_id, doc_name, event, at").eq("owner_id", id).order("at", { ascending: false }).limit(500),
    sb.from("chat_messages").select("role, text, sources, form_ids, packs, at").eq("owner_id", id).order("at").limit(200),
  ])
  for (const result of [o, d, e, c])
    if (result.error) throw new Error("Could not restore account data.")
  if (!o.data) return null
  return {
    profile: o.data.profile,
    items: o.data.items ?? {},
    lastDiff: o.data.last_diff,
    docs: (d.data ?? []).map((r) => ({
      id: r.id,
      fileName: r.file_name,
      mime: r.mime,
      size: r.size,
      sha256: r.sha256,
      uploadedAt: r.uploaded_at,
      requirementId: r.requirement_id ?? undefined,
      expectedTypes: r.expected_types,
      extracted: r.extracted,
      checks: r.checks,
      verdict: r.verdict,
      ownerConfirmed: r.owner_confirmed,
      storagePath: r.storage_path ?? undefined,
    })),
    vaultLog: (e.data ?? []).map((r) => ({ docId: r.doc_id, docName: r.doc_name, event: r.event, at: r.at })),
    chat: (c.data ?? []).map((r) => ({ role: r.role, text: r.text, sources: r.sources ?? undefined, formIds: r.form_ids ?? undefined, packs: r.packs ?? undefined, at: r.at })),
  }
}

export async function pushOwner(
  state: Pick<ServerState, "profile" | "items" | "lastDiff">,
  expectedOwnerId: string
) {
  const o = await owner(expectedOwnerId)
  if (!o) return false
  const result = await o.sb
    .from("owners")
    .update({
      profile: capped(state.profile, 100_000),
      items: capped(state.items ?? {}, 50_000),
      last_diff: capped(state.lastDiff, 10_000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", o.id)
    .select("id")
  checked(result)
  if (!result.data?.length) throw new Error("Could not save account data: no row was acknowledged.")
  return true
}

export async function saveDocuments(docs: VaultDoc[], expectedOwnerId: string) {
  const o = await owner(expectedOwnerId)
  if (!o) return false
  if (!Array.isArray(docs) || docs.length > 200 || docs.some((d) => !UUID.test(d.id) || !VERDICTS.has(d.verdict))) throw new Error("Invalid documents to sync")
  const rows = docs
    .map((d) => ({
      owner_id: o.id,
      id: d.id,
      file_name: String(d.fileName).slice(0, 255),
      mime: String(d.mime).slice(0, 100),
      size: Math.max(0, Math.floor(Number(d.size) || 0)),
      sha256: String(d.sha256).slice(0, 64),
      storage_path: d.storagePath?.startsWith(`${o.id}/`) ? d.storagePath : null,
      requirement_id: d.requirementId ? String(d.requirementId).slice(0, 60) : null,
      expected_types: (d.expectedTypes ?? []).slice(0, 20).map(String),
      extracted: capped(d.extracted, 10_000),
      checks: capped(d.checks, 20_000),
      verdict: d.verdict,
      owner_confirmed: Boolean(d.ownerConfirmed),
      uploaded_at: d.uploadedAt,
    }))
  if (rows.length) checked(await o.sb.from("documents").upsert(rows, { onConflict: "owner_id,id" }))
  return true
}

export async function appendVaultEvents(
  events: VaultEvent[],
  expectedOwnerId: string
) {
  const o = await owner(expectedOwnerId)
  if (!o) return false
  if (!Array.isArray(events) || events.length > 100) throw new Error("Invalid events to sync")
  const rows = events.map((e) => ({
    owner_id: o.id,
    doc_id: UUID.test(e.docId) ? e.docId : null,
    doc_name: String(e.docName).slice(0, 255),
    event: String(e.event).slice(0, 500),
    at: e.at,
  }))
  if (rows.length) {
    // A retried batch may already have committed before its response was lost.
    const previous = await o.sb.from("vault_events").select("doc_id, doc_name, event, at").eq("owner_id", o.id).gte("at", rows.map((r) => r.at).sort()[0])
    checked(previous)
    const key = (r: { doc_id: string | null; doc_name: string; event: string; at: string }) => JSON.stringify([r.doc_id, r.doc_name, r.event, new Date(r.at).toISOString()])
    const known = new Set((previous.data ?? []).map(key))
    const missing = rows.filter((r) => !known.has(key(r)))
    if (missing.length) checked(await o.sb.from("vault_events").insert(missing))
  }
  return true
}

export async function deleteDocument(docId: string, expectedOwnerId: string) {
  const o = await owner(expectedOwnerId)
  if (!o) return false
  if (!UUID.test(docId)) throw new Error("Invalid document to delete")
  checked(await o.sb.storage.from(BUCKET).remove([`${o.id}/${docId}`]))
  checked(await o.sb.from("documents").delete().eq("owner_id", o.id).eq("id", docId))
  return true
}

// Short-lived link to view a stored file; only for the cookie's owner.
export async function documentUrl(docId: string) {
  const sb = db()
  const id = await ownerId()
  if (!sb || !id || !UUID.test(docId)) return null
  const { data } = await sb.from("documents").select("storage_path").eq("owner_id", id).eq("id", docId).maybeSingle()
  if (!data?.storage_path) return null
  const signed = await sb.storage.from(BUCKET).createSignedUrl(data.storage_path, 300)
  return signed.data?.signedUrl ?? null
}

export async function clearChat(expectedOwnerId: string) {
  const o = await owner(expectedOwnerId)
  if (!o) return false
  checked(await o.sb.from("chat_messages").delete().eq("owner_id", o.id))
  return true
}

// "Delete all my data": files, rows (cascade) and cookies.
export async function deleteAllData(expectedOwnerId: string) {
  const id = await ownerId()
  if (!id || id !== expectedOwnerId) throw new Error("Account changed. Reload before deleting.")
  const sb = db()
  if (sb && id) {
    const { data } = await sb.storage.from(BUCKET).list(id, { limit: 1000 })
    if (data?.length) await sb.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
    await sb.from("owners").delete().eq("id", id)
  }
  await clearSession()
}
