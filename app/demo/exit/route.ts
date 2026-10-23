import { redirect } from "next/navigation"

import { clearSession } from "@/lib/session"

// Leaves the demo: this device goes back to a fresh, anonymous start.
export async function GET() {
  await clearSession()
  redirect("/")
}
