import { DemoCheckout } from "@/components/demo-checkout"

export default async function Page({ params }: PageProps<"/pay/demo/[txn]">) {
  const { txn } = await params
  return <DemoCheckout txnid={txn} />
}
