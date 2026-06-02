export interface Shortcut { id: string; keys: string[]; label: string; scope: "global" | "pos" | "table" | "form"; }
export const shortcuts: Shortcut[] = [
  { id: "command", keys: ["Meta", "K"], label: "Open command palette", scope: "global" },
  { id: "search", keys: ["/"], label: "Focus search", scope: "global" },
  { id: "pos-product-search", keys: ["F2"], label: "POS product search", scope: "pos" },
  { id: "pos-payment", keys: ["F4"], label: "POS payment", scope: "pos" },
  { id: "pos-checkout", keys: ["F8"], label: "POS checkout", scope: "pos" },
  { id: "save", keys: ["Meta", "S"], label: "Save draft", scope: "form" },
  { id: "undo", keys: ["Meta", "Z"], label: "Undo", scope: "form" }
];
export function shortcutsFor(scope: Shortcut["scope"]): Shortcut[] { return shortcuts.filter((shortcut) => shortcut.scope === scope || shortcut.scope === "global"); }
