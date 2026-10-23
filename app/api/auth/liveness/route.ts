import { redirect } from "next/navigation"

import { egov } from "@/lib/egov"
import { readSession, writeSession } from "@/lib/session"
import { createSupabaseServerClient } from "@/lib/supabase"

// Step 3: liveness done → eVerify against the National ID → back to onboarding.
export async function GET() {
  const session = await readSession()
  if (!session?.livenessSessionId) redirect("/register?auth_error=no_session")

  let next = "/onboarding?verified=1"
  try {
    const face = await egov("liveness").result(session.livenessSessionId)
    const check = face.passed
      ? await egov("everify").verify(session.identity, session.livenessSessionId)
      : { verified: false }
    if (!check.verified) next = "/register?auth_error=not_verified"
    const identity = "fullAddress" in check && check.fullAddress
      ? { ...session.identity, address: check.fullAddress }
      : session.identity
    await writeSession({ identity, verified: check.verified })
    if (check.verified) {
      const client = await createSupabaseServerClient()
      if (client) await client.auth.signOut({ scope: "local" })
    }
  } catch (e) {
    console.error("Liveness / eVerify failed", e)
    next = "/register?auth_error=verify"
  }
  redirect(next)
}
