"use client"

import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import {
  configureAccount,
  getConfiguredAccount,
  subscribeStore,
} from "@/lib/store"

export function AccountScope({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  const pathname = usePathname()
  const configuredUserId = useSyncExternalStore(
    subscribeStore,
    getConfiguredAccount,
    () => undefined
  )

  useEffect(() => {
    configureAccount(userId)
  }, [userId])

  // Mount profile readers only after the current account's local cache is selected.
  return pathname === "/" ||
    pathname === "/register" ||
    configuredUserId === userId
    ? children
    : null
}
