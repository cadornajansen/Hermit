"use server"

import { isAuthError } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { validateSignIn, validateSignUp } from "@/lib/auth-validation"
import { clearSession } from "@/lib/session"
import { createSupabaseServerClient } from "@/lib/supabase"

export type AuthActionResult = { error?: string; message?: string; email?: string }

const UNAVAILABLE = "Email signup is currently unavailable. Please try again later."
const CHECK_EMAIL = "Check your email for a confirmation link. If you already have an account, you can sign in."

function callbackUrl(): string | null {
  const appUrl = process.env.APP_URL
  if (!appUrl) return null
  try {
    const url = new URL("/auth/callback", appUrl)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function connectionError(error: unknown): AuthActionResult {
  if (isAuthError(error) || (error instanceof TypeError && /fetch|network/i.test(error.message))) {
    return { error: "We could not connect to sign-in. Please try again shortly." }
  }
  throw error
}

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  const fields = validateSignUp(formData)
  if (!fields.ok) return { error: fields.error }
  const client = await createSupabaseServerClient()
  if (!client) return { error: UNAVAILABLE }
  const emailRedirectTo = callbackUrl()
  if (!emailRedirectTo) return { error: "Email confirmation is currently unavailable. Please try again later." }

  const { email, password, fullName } = fields.value
  let hasSession = false
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo },
    })
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") return { message: CHECK_EMAIL, email }
      if (error.code === "over_email_send_rate_limit" || error.status === 429) {
        return { error: "Please wait a moment before trying again." }
      }
      return { error: "We could not create an account. Please try again, or sign in if you already have one." }
    }
    hasSession = Boolean(data.session)
  } catch (error) {
    return connectionError(error)
  }
  if (hasSession) {
    // An ordinary email account does not inherit a previous eGov identity.
    await clearSession()
    redirect("/onboarding")
  }
  return { message: CHECK_EMAIL, email }
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const fields = validateSignIn(formData)
  if (!fields.ok) return { error: fields.error }
  const client = await createSupabaseServerClient()
  if (!client) return { error: UNAVAILABLE }
  try {
    const { error } = await client.auth.signInWithPassword(fields.value)
    if (error) return { error: "We could not sign you in. Check your email and password, and confirm your email if needed." }
  } catch (error) {
    return connectionError(error)
  }
  await clearSession()
  redirect("/onboarding")
}

export async function signOut(): Promise<void> {
  try {
    const client = await createSupabaseServerClient()
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" })
      if (error) throw error
    }
  } finally {
    await clearSession()
  }
}
