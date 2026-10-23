import { redirect } from "next/navigation"

export default function MemoryPage(): never {
  redirect("/assistant?view=memory")
}
