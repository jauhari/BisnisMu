import { GlassCard } from "../glass/glass-primitives";
import { GlassCombobox } from "../forms/glass-form";
import { formatMoney } from "@/presentation/format/number";

export function AccountCombobox({ label = "Search account" }: { label?: string }) { return <GlassCombobox>{label}<span className="text-muted">Search by name, code, or group</span></GlassCombobox>; }
export function JournalBalanceBar({ debit, credit }: { debit: bigint; credit: bigint }) { const diff = debit - credit; return <GlassCard className="sticky bottom-4 z-20 grid gap-3 md:grid-cols-3"><div><p className="text-xs text-muted">Debit</p><p className="font-semibold tabular-nums">{formatMoney(debit)}</p></div><div><p className="text-xs text-muted">Credit</p><p className="font-semibold tabular-nums">{formatMoney(credit)}</p></div><div><p className="text-xs text-muted">Difference</p><p className={diff === 0n ? "font-semibold text-success tabular-nums" : "font-semibold text-danger tabular-nums"}>{formatMoney(diff)}</p></div></GlassCard>; }
export function SourceTracePanel({ source = "No source selected" }: { source?: string }) { return <GlassCard><h2 className="text-base font-semibold">Source trace</h2><p className="mt-2 text-sm text-muted">{source}</p></GlassCard>; }
