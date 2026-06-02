import { defaultTableQueryState, TableQueryState } from "./table-features";
import { TableLayoutState } from "./table-layout";

export interface GlassTableState { query: TableQueryState; layout: TableLayoutState; selectedIds: string[]; }
export type GlassTableAction =
  | { type: "search"; value: string }
  | { type: "filter"; key: string; value: unknown }
  | { type: "sort"; sort: Array<{ id: string; desc: boolean }> }
  | { type: "select"; ids: string[] }
  | { type: "layout"; layout: TableLayoutState };

export function defaultGlassTableState(): GlassTableState { return { query: defaultTableQueryState(), layout: { columnOrder: [], hiddenColumns: [], columnWidths: {}, sort: [] }, selectedIds: [] }; }
export function reduceGlassTableState(state: GlassTableState, action: GlassTableAction): GlassTableState {
  if (action.type === "search") return { ...state, query: { ...state.query, search: action.value } };
  if (action.type === "filter") return { ...state, query: { ...state.query, filters: { ...state.query.filters, [action.key]: action.value } } };
  if (action.type === "sort") return { ...state, query: { ...state.query, sort: action.sort }, layout: { ...state.layout, sort: action.sort } };
  if (action.type === "select") return { ...state, selectedIds: action.ids };
  return { ...state, layout: action.layout };
}
