import { GlassCard, GlassPanel } from "../glass/glass-primitives";

export function PosRegisterShell() {
  return <div className="grid min-h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[1fr_420px]">
    <GlassPanel className="grid grid-rows-[auto_1fr] gap-4"><div className="flex items-center gap-3"><button className="h-12 rounded-md bg-foreground px-4 text-background">Scan / Search</button><button className="h-12 rounded-md border border-border px-4">Customer</button><button className="h-12 rounded-md border border-border px-4">Deposit</button></div><div className="grid content-start gap-3 md:grid-cols-3 xl:grid-cols-4"><GlassCard>Fast product tile</GlassCard><GlassCard>Barcode ready</GlassCard><GlassCard>Shortcut F2</GlassCard></div></GlassPanel>
    <GlassPanel className="grid grid-rows-[auto_1fr_auto] gap-4"><h2 className="text-lg font-semibold">Cart</h2><div className="rounded-lg border border-border p-4 text-sm text-muted">Cart lines, quantities, discounts, and tax controls</div><div className="grid gap-2"><button className="h-14 rounded-md bg-foreground text-background">Checkout F8</button><button className="h-12 rounded-md border border-border">Split payment</button><button className="h-12 rounded-md border border-border">Change to deposit</button></div></GlassPanel>
  </div>;
}
