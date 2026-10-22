import { Onboarding } from "@/components/onboarding"
import { readSession } from "@/lib/session"

const AUTH_ERRORS: Record<string, string> = {
  missing_code: "Hindi natapos ang eGovPH sign-in. Subukan ulit.",
  sso: "Hindi natapos ang eGovPH sign-in (expired o nagamit na ang code). Subukan ulit, o mag-type muna nang manual.",
}

export default async function Page({ searchParams }: PageProps<"/onboarding">) {
  const { auth_error } = await searchParams
  const session = await readSession()
  const id = session?.identity
  return (
    <main className="mx-auto min-h-svh max-w-xl px-4 py-6">
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
  )
}
