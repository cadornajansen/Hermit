import { Brand, PaperworkDecor } from "@/components/brand"
import { Onboarding } from "@/components/onboarding"
import { readSession } from "@/lib/session"

const AUTH_ERRORS: Record<string, string> = {
  missing_code: "eGovPH sign-in wasn't completed. Try again, or enter your details below.",
  sso: "eGovPH sign-in didn't finish (the code expired or was already used). Try again, or enter your details below.",
}

export default async function Page({ searchParams }: PageProps<"/onboarding">) {
  const { auth_error } = await searchParams
  const session = await readSession()
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
            id
              ? {
                  ownerName: [id.firstName, id.middleName, id.lastName].filter(Boolean).join(" "),
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
          sso={Boolean(id?.uniqid)}
          authError={typeof auth_error === "string" ? AUTH_ERRORS[auth_error] : undefined}
        />
      </main>
    </div>
  )
}
