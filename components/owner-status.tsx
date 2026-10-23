"use client"

import { CloudOff, RefreshCw } from "lucide-react"
import { useTransition, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import { hydrate, useHermit } from "@/lib/store"

export function OwnerStatus(): ReactElement | null {
  const { scopeError, syncError } = useHermit()
  const [retrying, startRetry] = useTransition()
  return scopeError || syncError ? (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground sm:items-center">
      <CloudOff aria-hidden="true" className="mt-3 size-4 shrink-0 sm:mt-0" />
      <p className="min-w-0 flex-1 py-2 leading-relaxed">{scopeError ?? syncError}</p>
      <Button variant="ghost" className="h-11 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs text-foreground" disabled={retrying} aria-busy={retrying} aria-label="Retry loading account" onClick={() => startRetry(async () => { await hydrate() })}>
        <RefreshCw aria-hidden="true" className={retrying ? "size-3.5 animate-spin motion-reduce:animate-none" : "size-3.5"} />
        {retrying ? "Retrying…" : "Retry"}
      </Button>
    </div>
  ) : null
}
