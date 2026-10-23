import "server-only"

import { createServerClient } from "@supabase/ssr"
import { isAuthError, type SupabaseClient, type User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { cache } from "react"

function configuration(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return null
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol)) return null
  } catch {
    return null
  }
  return { url, key }
}

export function getSupabaseAuthConfigured(): boolean {
  return configuration() !== null
}

export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = configuration()
  if (!config) return null
  const cookieStore = await cookies()
  return createServerClient(config.url, config.key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(values) {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options)
        } catch (error) {
          // Server Components cannot write cookies; the auth proxy handles refreshes.
          if (error instanceof Error && error.message.startsWith("Cookies can only be modified in a Server Action or Route Handler.")) return
          throw error
        }
      },
    },
  })
}

// React cache deduplicates validation within a render, never across account requests.
export const getAccountUser = cache(async (): Promise<User | null> => {
  const client = await createSupabaseServerClient()
  if (!client) return null
  try {
    const { data, error } = await client.auth.getUser()
    return error ? null : data.user
  } catch (error) {
    if (isAuthError(error) || (error instanceof TypeError && /fetch|network/i.test(error.message))) return null
    throw error
  }
})
