export interface TableLayoutState { columnOrder: string[]; hiddenColumns: string[]; columnWidths: Record<string, number>; sort: Array<{ id: string; desc: boolean }>; }
const memory = new Map<string, TableLayoutState>();
export function saveTableLayout(key: string, state: TableLayoutState): void { memory.set(key, state); }
export function loadTableLayout(key: string): TableLayoutState | null { return memory.get(key) ?? null; }
