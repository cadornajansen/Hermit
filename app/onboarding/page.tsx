import { Onboarding } from "@/components/onboarding"
import { readSession } from "@/lib/session"

const AUTH_ERRORS: Record<string, string> = {
  missing_code: "Hindi natapos ang eGovPH sign-in. Subukan ulit.",
  sso: "Hindi ma-reach ang eGovPH ngayon. Puwede kang mag-manual muna.",
  no_session: "Nag-expire ang sign-in. Subukan ulit.",
  not_verified: "Hindi na-verify ang National ID mo. Puwede kang mag-manual gamit ang ibang ID.",
  verify: "Hindi ma-reach ang eVerify ngayon. Puwede kang mag-manual muna.",
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
        authError={typeof auth_error === "string" ? AUTH_ERRORS[auth_error] : undefined}
      />
    </main>
  )
}
