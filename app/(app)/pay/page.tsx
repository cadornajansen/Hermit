import { PayTerminal } from "@/components/pay-terminal"

export default async function Page({ searchParams }: PageProps<"/pay">) {
  const { form, txn, amount } = await searchParams
  return (
    <PayTerminal
      initialForm={typeof form === "string" ? form : ""}
      returnTxn={typeof txn === "string" ? txn : ""}
      initialAmount={typeof amount === "string" && /^\d+(\.\d{1,2})?$/.test(amount) ? amount : ""}
    />
  )
}
