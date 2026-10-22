import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">HERMIT</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Isang checklist para sa lahat ng permit ng negosyo mo.
        </h1>
        <p className="text-muted-foreground">
          DTI, barangay, Mayor&apos;s Permit, BIR, SSS, PhilHealth, Pag-IBIG — HERMIT tells you what you need, what&apos;s
          done, what&apos;s due, and fills the forms for you.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>
          Simulan · Get started
        </Link>
        <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline" })}>
          May profile na ako · Open my checklist
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        HERMIT prepares and hands off — it never submits anything without you. Not legal or tax advice.
      </p>
    </main>
  )
}
