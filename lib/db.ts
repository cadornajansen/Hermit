import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Server-only Supabase client with the secret key. Never import from client code.
// Returns null when Supabase isn't configured, so local dev works device-only.
let client: SupabaseClient | null | undefined

export function db() {
  if (client !== undefined) return client
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  return client
}

export const BUCKET = "documents"
