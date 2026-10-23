"use client"

import Link from "next/link"

import type { VaultDoc } from "@/lib/types"
import { cn } from "@/lib/utils"
import { coverage, docName } from "@/lib/vault"

const TONE = {
  verified: "text-primary",
  needs_review: "text-amber-700 dark:text-amber-400",
  rejected: "text-destructive",
  missing: "text-muted-foreground",
}
const MARK = { verified: "✓", needs_review: "!", rejected: "✗", missing: "○" }

// Per-requirement document tracker shown on the checklist.
export function DocSlots({ requirementId, docs }: { requirementId: string; docs: VaultDoc[] }) {
  const c = coverage(requirementId, docs)
  if (!c) return null
  const slots = [...c.needs, ...(c.issued ? [c.issued] : [])]
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Your documents</p>
      <ul className="divide-y divide-border/60">
        {slots.map((slot, i) => {
          const state = slot.doc?.verdict ?? "missing"
          const issued = slot === c.issued
          return (
            <li key={i} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
              <span className={cn("min-w-0 text-sm leading-5", TONE[state])}>
                {MARK[state]} {slot.types.map(docName).join(" / ")}
                {issued && <span className="block text-xs text-muted-foreground">Issued by the office</span>}
              </span>
              {state !== "verified" && (
                <Link
                  href={`/vault?req=${requirementId}${slot.types.length === 1 ? `&type=${slot.types[0]}` : ""}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {state === "missing" ? "Upload" : "Review"}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
