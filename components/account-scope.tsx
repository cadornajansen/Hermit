"use client"

import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { configureOwner, getConfiguredOwner, subscribeStore } from "@/lib/store"

export function AccountScope({ ownerId, children }: { ownerId: string | null; children: ReactNode }) {
  const pathname = usePathname()
  const configuredOwner = useSyncExternalStore(subscribeStore, getConfiguredOwner, () => undefined)

  useEffect(() => {
    configureOwner(ownerId)
  }, [ownerId])

  return pathname === "/" || pathname === "/register" || configuredOwner === ownerId
    ? children
    : null
}
