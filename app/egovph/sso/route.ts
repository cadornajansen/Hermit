import { redirect } from "next/navigation"
import { randomUUID } from "node:crypto"

import { db } from "@/lib/db"
import { egov } from "@/lib/egov"
import { ownerId, readSession, setOwner, writeSession } from "@/lib/session"

// eGovPH SSO entry point. eGovPH opens HERMIT inside its app as
//   https://<hermit>/egovph/sso?exchange_code=…
// and the "Login as eGov" widget sends its exchange code here too.
// The citizen arrives already signed in: we redeem the code, match or bind
// their eGovPH account (uniqid) to an owner, and continue — no HERMIT login.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("exchange_code")
  if (!code || code.length > 200) redirect("/onboarding?auth_error=missing_code")

  let next = "/onboarding?sso=1"
  try {
    const identity = await egov("sso").exchange(code)
    const previous = await readSession()

    const sb = db()
    if (sb && identity.uniqid) {
      const { data: existing, error } = await sb.from("owners").select("id, profile").eq("egov_uniqid", identity.uniqid).maybeSingle()
      if (error) throw new Error("Could not resolve eGov account")
      if (existing) {
        // Returning citizen: this device now opens their saved HERMIT data.
        await setOwner(existing.id)
        next = existing.profile ? "/dashboard?restore=1" : "/onboarding?sso=1&restore=1"
      } else {
        // A new identity must never claim the previous citizen's owner row.
        const id = randomUUID()
        const { error } = await sb.from("owners").insert({ id, egov_uniqid: identity.uniqid })
        if (error) throw new Error("Could not create eGov account")
        await setOwner(id)
      }
    } else if (!identity.uniqid || previous?.identity.uniqid !== identity.uniqid) {
      // Without a backend mapping, reuse the cookie only for a proven same identity.
      await setOwner(randomUUID())
    } else {
      await ownerId(true)
    }
    await writeSession({ identity, verified: false })
  } catch (e) {
    console.error("eGovPH SSO failed", e)
    next = "/onboarding?auth_error=sso"
  }
  redirect(next)
}
