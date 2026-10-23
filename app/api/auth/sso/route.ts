import { redirect } from "next/navigation"

import { egov } from "@/lib/egov"
import { getAccountUser } from "@/lib/supabase"

// Step 1: send the owner to eGovPH SSO.
export async function GET(request: Request) {
  if (await getAccountUser()) redirect("/onboarding")
  const { origin } = new URL(request.url)
  redirect(egov("sso").loginUrl(`${origin}/api/auth/callback`))
}
