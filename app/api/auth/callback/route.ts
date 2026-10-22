import { redirect } from "next/navigation"

import { egov } from "@/lib/egov"
import { writeSession } from "@/lib/session"

// Step 2: SSO hands back an exchange code → citizen profile → start Face Liveness.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("exchange_code")
  if (!code) redirect("/onboarding?auth_error=missing_code")

  let next: string
  try {
    const identity = await egov("sso").exchange(code)
    const live = await egov("liveness").start(`${url.origin}/api/auth/liveness`)
    await writeSession({ identity, livenessSessionId: live.sessionId, verified: false })
    next = live.url
  } catch (e) {
    console.error("SSO exchange failed", e)
    next = "/onboarding?auth_error=sso"
  }
  redirect(next)
}
