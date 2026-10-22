"use client"

import { Button } from "@/components/ui/button"
import { hydrate, useHermit } from "@/lib/store"

export function OwnerStatus() {
  const { scopeError } = useHermit()
  return scopeError ? (
    <div role="alert" className="mb-4 flex flex-col gap-2 text-sm">
      <p>{scopeError}</p>
      <Button variant="outline" onClick={() => void hydrate()}>
        Retry loading account
      </Button>
    </div>
  ) : null
}
