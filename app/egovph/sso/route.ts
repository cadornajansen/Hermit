import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { egov } from "@/lib/egov"
import { ownerId, setOwner, writeSession } from "@/lib/session"

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
    await writeSession({ identity, verified: false })

    const sb = db()
    if (sb && identity.uniqid) {
      const { data: existing } = await sb.from("owners").select("id, profile").eq("egov_uniqid", identity.uniqid).maybeSingle()
      if (existing) {
        // Returning citizen: this device now opens their saved HERMIT data.
        await setOwner(existing.id)
        next = existing.profile ? "/dashboard?restore=1" : "/onboarding?sso=1&restore=1"
      } else {
        const id = await ownerId(true)
        await sb.from("owners").upsert({ id, egov_uniqid: identity.uniqid }, { onConflict: "id" })
      }
    }
  } catch (e) {
    console.error("eGovPH SSO failed", e)
    next = "/onboarding?auth_error=sso"
  }
  redirect(next)
}
