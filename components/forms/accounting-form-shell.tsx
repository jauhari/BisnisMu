import type { ReactNode } from "react";
import { JournalBalanceBar, SourceTracePanel } from "../accounting/accounting-components";
import { GlassPanel } from "../glass/glass-primitives";
import { DirtyStateBadge, PrimaryWorkflowButton, UndoButton, WorkflowActionBar } from "./workflow-actions";

export function AccountingFormShell({ children, debit = 0n, credit = 0n }: { children: ReactNode; debit?: bigint; credit?: bigint }) {
  return <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><div className="grid gap-5"><GlassPanel>{children}</GlassPanel><JournalBalanceBar debit={debit} credit={credit} /><WorkflowActionBar><DirtyStateBadge dirty={false} /><div className="flex gap-2"><UndoButton disabled /><PrimaryWorkflowButton>Preview journal</PrimaryWorkflowButton></div></WorkflowActionBar></div><SourceTracePanel source="Source transaction and journal traceability appear here." /></div>;
}
