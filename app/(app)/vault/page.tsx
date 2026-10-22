import { Vault } from "@/components/vault"

export default async function Page({ searchParams }: PageProps<"/vault">) {
  const { req, type } = await searchParams
  return (
    <Vault
      initialRequirement={typeof req === "string" ? req : ""}
      initialType={typeof type === "string" ? type : ""}
    />
  )
}
