import { Chat } from "@/components/chat"

export default async function Page({ searchParams }: PageProps<"/assistant">) {
  const { q } = await searchParams
  return <Chat initialQuestion={typeof q === "string" ? q : ""} />
}
