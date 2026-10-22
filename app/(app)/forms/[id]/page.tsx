import { notFound } from "next/navigation"

import { FormSheet } from "@/components/form-sheet"
import { getForm } from "@/lib/forms"

export default async function Page({ params }: PageProps<"/forms/[id]">) {
  const { id } = await params
  if (!getForm(id)) notFound()
  return <FormSheet id={id} />
}
