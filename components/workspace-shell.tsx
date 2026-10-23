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
import { DEMO_OWNER } from "@/lib/demo-id"
import { useHermit } from "@/lib/store"
import { cn } from "@/lib/utils"
import "@/components/workspace.css"

function BusinessLink({ name, collapsed = false, onNavigate }: { name: string; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/profile" onClick={onNavigate} title={collapsed ? name : undefined} aria-label={`${name}: business details`} className={cn("relative flex h-11 min-w-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", collapsed && "mx-auto w-11 justify-center border-transparent px-0")}>
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">{name.slice(0, 1).toUpperCase()}</span>
      {!collapsed && <><span className="min-w-0 flex-1 truncate">{name}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" /></>}
    </Link>
  )
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { profile, ownerId } = useHermit()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const businessName = profile?.businessName.trim() || "Your business"
  const wide = ["/dashboard", "/roadmap", "/calendar", "/vault", "/forms", "/offices", "/business"].includes(pathname)
  const sidebarTransition = { duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div data-workspace className="min-h-svh bg-canvas text-foreground lg:flex print:block print:bg-background">
      <a href="#workspace-content" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-background px-4 py-3 text-sm shadow-lg focus:not-sr-only">Skip to content</a>
      <motion.aside initial={false} animate={{ width: collapsed ? 68 : 224 }} transition={sidebarTransition} className="sticky top-0 hidden h-svh shrink-0 flex-col gap-2 border-r border-border bg-background p-2 lg:flex print:hidden" aria-label="Workspace sidebar">
        <div className={cn("flex h-11 shrink-0 items-center justify-between", collapsed && "justify-center")}>
          <Brand compact={collapsed} className={cn("min-w-11 px-1.5 whitespace-nowrap", collapsed && "w-11 justify-center px-0")} />
          {!collapsed && <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded onClick={() => setCollapsed(true)}><PanelLeftClose aria-hidden="true" /></Button>}
        </div>
        <BusinessLink name={businessName} collapsed={collapsed} />
        <div className="workspace-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto">
          <div className={cn("shrink-0", collapsed && "flex justify-center")}><WorkspaceSearch compact={collapsed} /></div>
          <Nav collapsed={collapsed} />
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Separator />
          {collapsed && <Button variant="ghost" size="icon" className="mx-auto rounded-lg" aria-label="Expand sidebar" title="Expand sidebar" aria-expanded={false} onClick={() => setCollapsed(false)}><PanelLeftOpen aria-hidden="true" /></Button>}
          <Nav collapsed={collapsed} section="account" />
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

        {ownerId === DEMO_OWNER && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 print:hidden">
            <span>
              <strong>Demo business</strong> · sample data, shared with everyone who opens the demo
            </span>
            <a href="/demo" className="underline underline-offset-2">
              Reset demo
            </a>
            <a href="/demo/exit" className="underline underline-offset-2">
              Exit demo
            </a>
          </div>
        )}
        <main id="workspace-content" tabIndex={-1} className={cn("mx-auto w-full min-w-0 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0", wide ? "max-w-[1280px]" : "max-w-3xl")}>
          {children}
        </main>
      </div>
    </div>
  )
}
