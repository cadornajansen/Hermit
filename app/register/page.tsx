import { redirect } from "next/navigation"

import { AccountForm } from "@/components/account-form"
import { Brand, PaperworkDecor } from "@/components/brand"
import { getAccountUser } from "@/lib/supabase"
import { readSession } from "@/lib/session"

const AUTH_ERRORS: Record<string, string> = {
  confirmation:
    "We couldn’t confirm your email. Open your latest confirmation link or sign in again.",
  missing_code: "Your sign-in was not completed. Please try again.",
  sso: "We couldn’t reach eGov. Please try again or sign in with your email.",
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [user, session] = await Promise.all([getAccountUser(), readSession()])
  if (user || session?.verified) redirect("/onboarding")

  const { auth_error } = await searchParams
  const authError =
    typeof auth_error === "string"
      ? (AUTH_ERRORS[auth_error] ??
        "Your sign-in could not be completed. Please try again.")
      : undefined

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-linear-to-b from-sky via-canvas to-background">
      <header className="relative mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center px-5 sm:px-10">
        <Brand />
      </header>
      <PaperworkDecor />
      <main className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-1 pb-4 sm:px-6 sm:pb-6">
        <AccountForm authError={authError} />
      </main>
    </div>
  )
}
