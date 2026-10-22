import { notFound } from "next/navigation"

import { PdfEditor } from "@/components/pdf-editor"
import { getForm } from "@/lib/forms"

export default async function Page({ params, searchParams }: PageProps<"/forms/[id]/fill">) {
  const { id } = await params
  const { file } = await searchParams
  if (!getForm(id)) notFound()
  return <PdfEditor formId={id} filePath={typeof file === "string" ? file : undefined} />
}
