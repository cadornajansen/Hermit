import { isAuthError } from "@supabase/supabase-js"

import { clearSession } from "@/lib/session"
import { createSupabaseServerClient } from "@/lib/supabase"

function go(location: "/onboarding" | "/register?auth_error=confirmation"): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "private, no-store" },
  })
}

export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code")
  if (!code) return go("/register?auth_error=confirmation")
  const client = await createSupabaseServerClient()
  if (!client) return go("/register?auth_error=confirmation")
  try {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) return go("/register?auth_error=confirmation")
  } catch (error) {
    if (isAuthError(error) || (error instanceof TypeError && /fetch|network/i.test(error.message))) {
      return go("/register?auth_error=confirmation")
    }
    throw error
  }
  await clearSession()
  return go("/onboarding")
}
