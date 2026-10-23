import {
  BookOpen, BriefcaseBusiness, Building2, Check, ChevronRight, Circle,
  CircleDot, CircleHelp, Clock3, FileCheck2, FileText, Flame, HeartPulse,
  Landmark, Leaf, LockKeyhole, PackageCheck, ReceiptText, RefreshCw,
  Send, ShieldCheck, Store, UsersRound, Wine, type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { getBlockers, isCompleted } from "@/lib/dashboard-summary"
import { STATUS_LABEL, type ComplianceItem, type Status } from "@/lib/types"
import { cn } from "@/lib/utils"

const REQUIREMENT_ICONS: Record<string, LucideIcon> = {
  dti_bn: Store,
  sec_reg: Building2,
  cda_reg: UsersRound,
  brgy_clearance: Landmark,
  mayors_permit: FileCheck2,
  fsic: Flame,
  sanitary_permit: ShieldCheck,
  health_certs: HeartPulse,
  cenro: Leaf,
  liquor_license: Wine,
  bir_cor: ReceiptText,
  bir_books: BookOpen,
  bir_invoices: ReceiptText,
  bir_display: FileText,
  tax_option: ReceiptText,
  platform_withholding: ReceiptText,
  bmbe: Store,
  fda_lto: ShieldCheck,
  fda_cpr: PackageCheck,
  regulated_review: CircleHelp,
  sss_er: UsersRound,
  philhealth_er: HeartPulse,
  pagibig_er: Building2,
  dole_1020: BriefcaseBusiness,
  withholding_comp: ReceiptText,
  brgy_renewal: RefreshCw,
  mayors_renewal: RefreshCw,
}

export function RequirementIcon({ item, className }: { item: ComplianceItem; className?: string }) {
  const Icon = REQUIREMENT_ICONS[item.id] ?? FileText
  return <Icon className={className} aria-hidden="true" />
}

const statusBadge = "h-auto min-h-[22px] rounded-md border-transparent px-[7px] py-0.5"

export function RequirementStatus({ status }: { status: Status }) {
  return (
    <Badge
      variant={status === "expired" ? "destructive" : status === "not_started" ? "outline" : "secondary"}
      className={cn(
        statusBadge,
        status === "not_started" && "bg-muted text-muted-foreground",
        status === "approved" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        status === "expiring" && "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      {status === "approved" ? "Completed" : STATUS_LABEL[status]}
    </Badge>
  )
}

function taskAppearance(item: ComplianceItem, blocked: boolean): { Icon: LucideIcon; label: string; tone: string; marker: string } {
  if (item.status === "approved") return { Icon: Check, label: "Completed", tone: "text-emerald-700 dark:text-emerald-400", marker: "bg-emerald-600 text-white" }
  if (item.status === "expiring" || item.status === "expired") return { Icon: Clock3, label: STATUS_LABEL[item.status], tone: "text-amber-700 dark:text-amber-400", marker: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" }
  if (item.status === "submitted") return { Icon: Send, label: "Submitted", tone: "text-primary", marker: "bg-secondary text-primary" }
  if (blocked) return { Icon: LockKeyhole, label: "Prerequisite needed", tone: "text-muted-foreground", marker: "bg-muted text-muted-foreground" }
  if (item.status === "in_progress") return { Icon: CircleDot, label: "In progress", tone: "text-primary", marker: "bg-primary text-primary-foreground" }
  if (item.applies === "maybe") return { Icon: CircleHelp, label: "Confirm applicability", tone: "text-amber-700 dark:text-amber-400", marker: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" }
  return { Icon: Circle, label: "Not started", tone: "text-muted-foreground", marker: "bg-background text-muted-foreground" }
}

export function RequirementRow({ item, blocked = false, href, next = false }: {
  item: ComplianceItem
  blocked?: boolean
  href?: string
  next?: boolean
}) {
  const appearance = taskAppearance(item, blocked)
  const StatusIcon = appearance.Icon
  return (
    <Link
      href={href ?? `/roadmap?requirement=${encodeURIComponent(item.id)}`}
      scroll={false}
      className={cn(
        "group relative flex min-h-20 items-start gap-4 rounded-xl px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        next && "bg-secondary/70 hover:bg-secondary",
      )}
    >
      <span className={cn(
        "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-[0_2px_8px_-3px_rgba(31,52,85,0.18)] ring-1 ring-border/60",
        next && "bg-primary text-primary-foreground ring-primary/10 shadow-[0_3px_10px_-3px_rgba(32,84,255,0.4)]",
        isCompleted(item) && "text-emerald-700 dark:text-emerald-400",
      )} aria-hidden="true">
        <RequirementIcon item={item} className="size-5" />
        <span className={cn("absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-background", appearance.marker)}><StatusIcon className="size-2.5" /></span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        {next && <span className="text-xs font-medium text-primary">Next action</span>}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">{item.name}</span>
          {blocked && item.status === "not_started" ? <Badge variant="outline" className={cn(statusBadge, "bg-muted text-muted-foreground")}>Blocked</Badge> : <RequirementStatus status={item.status} />}
          {blocked && item.status === "in_progress" && <Badge variant="outline" className={cn(statusBadge, "bg-muted text-muted-foreground")}>Blocked</Badge>}
          {item.applies === "maybe" && <Badge variant="secondary" className={cn(statusBadge, "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300")}>Confirm</Badge>}
          {item.optional && <Badge variant="outline" className={statusBadge}>Optional</Badge>}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">{item.agency}</span>
      </span>
      <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" aria-hidden="true" />
    </Link>
  )
}

export function RequirementTimeline({ items, allItems, nextActionId }: {
  items: ComplianceItem[]
  allItems: ComplianceItem[]
  nextActionId?: string
}) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.id} className="relative">
          {index < items.length - 1 && <span className="absolute top-11 -bottom-3 left-[30px] w-px bg-border" aria-hidden="true" />}
          <RequirementRow
            item={item}
            next={item.id === nextActionId}
            blocked={!isCompleted(item) && item.status !== "submitted" && getBlockers(item, allItems).length > 0}
          />
        </li>
      ))}
    </ol>
  )
}
