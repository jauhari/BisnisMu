import type { ReactNode } from "react";
import { cn } from "@/presentation/theme/cn";
import { glassTokens } from "@/presentation/theme/tokens";

export function WorkflowActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(glassTokens.surface, "sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3", className)}>{children}</div>;
}

export function DirtyStateBadge({ dirty }: { dirty: boolean }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", dirty ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>{dirty ? "Unsaved changes" : "Saved"}</span>;
}

export function UndoButton({ disabled = false }: { disabled?: boolean }) {
  return <button type="button" disabled={disabled} className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-40">Undo</button>;
}

export function PrimaryWorkflowButton({ children }: { children: ReactNode }) {
  return <button type="button" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background shadow-sm">{children}</button>;
}
