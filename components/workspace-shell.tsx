"use client"

import { ArrowUpRight, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"

import { Brand } from "@/components/brand"
import { Nav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { WorkspaceSearch } from "@/components/workspace-search"
import { useHermit } from "@/lib/store"
import { cn } from "@/lib/utils"

function BusinessLink({ name, collapsed = false, onNavigate }: { name: string; collapsed?: boolean; onNavigate?: () => void }) {
  const reduceMotion = useReducedMotion()
  return (
    <Link href="/profile" onClick={onNavigate} title={collapsed ? name : undefined} aria-label={`${name}: business details`} className="relative flex min-h-11 min-w-11 items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-2.5 text-sm whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">{name.slice(0, 1).toUpperCase()}</span>
      <motion.span initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : 0.12, delay: collapsed || reduceMotion ? 0 : 0.08 }} aria-hidden={collapsed} className="min-w-0 flex-1 truncate">{name}</motion.span>
      <motion.span initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} aria-hidden="true" className="shrink-0">
        <ArrowUpRight className="size-3.5 text-muted-foreground" />
      </motion.span>
    </Link>
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { profile } = useHermit()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const businessName = profile?.businessName.trim() || "Your business"
  const wide = pathname === "/dashboard" || pathname === "/roadmap" || pathname === "/offices"
  const sidebarTransition = { duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div className="min-h-svh bg-canvas text-foreground lg:flex print:block print:bg-background">
      <a href="#workspace-content" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-background px-4 py-3 text-sm shadow-lg focus:not-sr-only">Skip to content</a>
      <motion.aside initial={false} animate={{ width: collapsed ? 72 : 247 }} transition={sidebarTransition} className="sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-background p-3 lg:flex print:hidden" aria-label="Workspace sidebar">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
          <BusinessLink name={businessName} collapsed={collapsed} />
          <motion.div initial={false} animate={{ height: collapsed ? 88 : 44 }} transition={sidebarTransition} className="relative shrink-0">
            <motion.div initial={false} animate={{ width: collapsed ? 44 : 140 }} transition={sidebarTransition} className="absolute top-0 left-0 overflow-hidden">
              <Brand className="min-h-11 min-w-11 px-1.5 whitespace-nowrap [&>span]:shrink-0" />
            </motion.div>
            <motion.div initial={false} animate={{ y: collapsed ? 44 : 0 }} transition={sidebarTransition} className="absolute top-0 right-0">
              <Button variant="ghost" size="icon" className="rounded-lg bg-transparent aria-expanded:bg-transparent" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
                {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
              </Button>
            </motion.div>
          </motion.div>
          <div className="shrink-0"><WorkspaceSearch compact={collapsed} /></div>
          <div className="flex flex-col gap-2">
            <motion.p initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} aria-hidden={collapsed} className="px-3 text-xs whitespace-nowrap text-muted-foreground">Workspace</motion.p>
            <Nav collapsed={collapsed} />
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <Separator />
            <Nav collapsed={collapsed} section="account" />
          </div>
        </div>
      </motion.aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background px-4 lg:hidden print:hidden">
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="rounded-lg" />} aria-label="Open navigation">
              <Menu aria-hidden="true" />
            </DialogTrigger>
            <DialogContent className="top-0 left-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-5 rounded-none p-4 sm:max-w-none [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:bg-transparent">
              <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
              <DialogDescription className="sr-only">Open a workspace page or manage your business profile.</DialogDescription>
              <div className="pr-12"><Brand className="min-h-11" /></div>
              <BusinessLink name={businessName} onNavigate={() => setDrawerOpen(false)} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Nav onNavigate={() => setDrawerOpen(false)} />
              </div>
              <Separator />
              <Nav section="account" onNavigate={() => setDrawerOpen(false)} />
            </DialogContent>
          </Dialog>
          <Link href="/profile" className="min-w-0 flex-1 truncate py-3 text-sm font-medium">{businessName}</Link>
          <WorkspaceSearch compact />
        </header>

        <main id="workspace-content" tabIndex={-1} className={cn("mx-auto w-full min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0", wide ? "max-w-[1440px]" : "max-w-3xl")}>
          {children}
        </main>
      </div>
    </div>
  )
}
