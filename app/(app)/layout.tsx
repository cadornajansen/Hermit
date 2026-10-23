import { WorkspaceShell } from "@/components/workspace-shell"
import { OwnerStatus } from "@/components/owner-status"

// AI document reading and packet generation can take longer than a default request.
export const maxDuration = 120

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell><OwnerStatus />{children}</WorkspaceShell>
}
