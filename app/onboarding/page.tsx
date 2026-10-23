import { Onboarding } from "@/components/onboarding"
import { Brand, PaperworkDecor } from "@/components/brand"
import { readSession } from "@/lib/session"
import { getAccountUser } from "@/lib/supabase"

const AUTH_ERRORS: Record<string, string> = {
  missing_code:
    "eGov sign-in was not completed. Try again or enter your details below.",
  sso: "We couldn’t reach eGov. You can enter your details below.",
  no_session: "Your sign-in expired. Please try again.",
  not_verified:
    "Identity verification was not completed. You can still enter your details below.",
  verify:
    "We couldn’t reach identity verification. You can enter your details below.",
}

export default async function Page({ searchParams }: PageProps<"/onboarding">) {
  const { auth_error } = await searchParams
  const [session, account] = await Promise.all([
    readSession(),
    getAccountUser(),
  ])
  const id = session?.identity
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-linear-to-b from-sky via-canvas to-background">
      <header className="relative mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center px-5 sm:px-10 [@media(max-height:600px)]:h-12">
        <Brand />
      </header>
      <PaperworkDecor />
      <main className="relative flex min-h-0 flex-1 items-start justify-center px-3 pt-2 pb-4 sm:px-6 sm:pb-6 [@media(max-height:600px)]:pt-0 [@media(max-height:600px)]:pb-2">
        <Onboarding
          identity={
            account
              ? {
                  ownerName:
                    typeof account.user_metadata.full_name === "string"
                      ? account.user_metadata.full_name
                      : "",
                  email: account.email ?? "",
                  birthDate: "",
                  homeAddress: "",
                  mobile: "",
                  barangay: "",
                  city: "Manila",
                  identityVerified: false,
                }
              : id
                ? {
                    ownerName: [id.firstName, id.middleName, id.lastName]
                      .filter(Boolean)
                      .join(" "),
                    birthDate: id.birthDate,
                    homeAddress: id.address,
                    mobile: id.mobile,
                    email: id.email,
                    barangay: id.barangay,
                    city: id.municipality,
                    identityVerified: session.verified,
                  }
                : null
          }
          authError={
            typeof auth_error === "string" ? AUTH_ERRORS[auth_error] : undefined
          }
        />
      </main>
    </div>
  )
}
