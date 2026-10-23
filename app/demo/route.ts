import { redirect } from "next/navigation"

import { DEMO_IDENTITY, resetDemo } from "@/lib/demo"
import { DEMO_OWNER } from "@/lib/demo-id"
import { setOwner, writeSession } from "@/lib/session"
import { createSupabaseServerClient, getAccountUser } from "@/lib/supabase"

// Opens the shared demo business, freshly reset, on this device.
// Anyone with the link sees the same sample data; nothing here is private.
export async function GET() {
  try {
    if (await getAccountUser()) await (await createSupabaseServerClient())!.auth.signOut({ scope: "local" })
    await resetDemo()
    await setOwner(DEMO_OWNER)
    await writeSession({ identity: DEMO_IDENTITY, verified: true })
  } catch (e) {
    console.error("demo reset failed", e)
    redirect("/?demo_error=1")
  }
  redirect("/dashboard?restore=1")
}
