import { commandRegistry } from "@/presentation/navigation/command-registry";
import { GlassCommandPalette } from "../glass/glass-primitives";

export function CommandPaletteSurface() {
  return <GlassCommandPalette><div className="text-sm font-medium">Command palette</div><div className="mt-3 grid max-h-80 gap-1 overflow-auto">{commandRegistry.slice(0, 12).map((item) => <div key={item.id} className="rounded-md px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10"><span className="text-muted">{item.group}</span><span className="mx-2 text-muted">/</span>{item.label}</div>)}</div></GlassCommandPalette>;
}
