import { OwnerStatus } from "@/components/owner-status"
import { WorkspaceShell } from "@/components/workspace-shell"

// Kuya Hermit answers and AI document reading run as Server Actions on these
// pages and can take 20–60 s; give them room instead of the platform default.
export const maxDuration = 120

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell>
      <OwnerStatus />
      {children}
    </WorkspaceShell>
  )
}
