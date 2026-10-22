import { redirect } from "next/navigation"

import { egov } from "@/lib/egov"

// Step 1: send the owner to eGovPH SSO.
export function GET(request: Request) {
  const { origin } = new URL(request.url)
  redirect(egov("sso").loginUrl(`${origin}/api/auth/callback`))
}
