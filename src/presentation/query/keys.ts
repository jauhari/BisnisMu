export const queryKeys = {
  dashboard: (businessId: string, range: string) => ["dashboard", businessId, range] as const,
  report: (businessId: string, report: string, range: string) => ["report", businessId, report, range] as const,
  list: (businessId: string, module: string, filters: Record<string, unknown>) => [module, businessId, "list", filters] as const,
  detail: (businessId: string, module: string, id: string) => [module, businessId, "detail", id] as const
};
