export interface GlassTableFeatureSet {
  stickyHeader: boolean;
  stickyColumns: boolean;
  resizeColumns: boolean;
  reorderColumns: boolean;
  hideColumns: boolean;
  saveLayout: boolean;
  exportExcel: boolean;
  exportPdf: boolean;
  search: boolean;
  filters: boolean;
  multiSort: boolean;
  bulkActions: boolean;
  infiniteScroll: boolean;
  virtualization: boolean;
}

export const defaultGlassTableFeatures: GlassTableFeatureSet = {
  stickyHeader: true,
  stickyColumns: true,
  resizeColumns: true,
  reorderColumns: true,
  hideColumns: true,
  saveLayout: true,
  exportExcel: true,
  exportPdf: true,
  search: true,
  filters: true,
  multiSort: true,
  bulkActions: true,
  infiniteScroll: true,
  virtualization: true
};

export interface TableQueryState { search: string; filters: Record<string, unknown>; sort: Array<{ id: string; desc: boolean }>; cursor?: string; }
export function defaultTableQueryState(): TableQueryState { return { search: "", filters: {}, sort: [] }; }
