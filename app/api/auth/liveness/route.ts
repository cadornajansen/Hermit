import { redirect } from "next/navigation"

import { egov } from "@/lib/egov"
import { readSession, writeSession } from "@/lib/session"

// Step 3: liveness done → eVerify against the National ID → back to onboarding.
export async function GET() {
  const session = await readSession()
  if (!session?.livenessSessionId) redirect("/onboarding?auth_error=no_session")

  let next = "/onboarding?verified=1"
  try {
    const face = await egov("liveness").result(session.livenessSessionId)
    const check = face.passed
      ? await egov("everify").verify(session.identity, session.livenessSessionId)
      : { verified: false }
    if (!check.verified) next = "/onboarding?auth_error=not_verified"
    const identity = "fullAddress" in check && check.fullAddress
      ? { ...session.identity, address: check.fullAddress }
      : session.identity
    await writeSession({ identity, verified: check.verified })
  } catch (e) {
    console.error("Liveness / eVerify failed", e)
    next = "/onboarding?auth_error=verify"
  }
  redirect(next)
}
