import { PayTerminal } from "@/components/pay-terminal"

export default async function Page({ searchParams }: PageProps<"/pay">) {
  const { form, txn } = await searchParams
  return <PayTerminal initialForm={typeof form === "string" ? form : ""} returnTxn={typeof txn === "string" ? txn : ""} />
}
