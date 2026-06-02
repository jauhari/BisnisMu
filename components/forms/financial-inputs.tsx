import { GlassInput } from "./glass-form";

export function MoneyInput(props: Record<string, unknown> & { className?: string }) { return <GlassInput inputMode="decimal" placeholder="Rp 0" {...props} />; }
export function PercentInput(props: Record<string, unknown> & { className?: string }) { return <GlassInput inputMode="decimal" placeholder="0%" {...props} />; }
