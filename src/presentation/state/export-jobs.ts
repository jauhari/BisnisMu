export type ExportFormat = "excel" | "pdf";
export interface ExportJobRequest { tableId: string; format: ExportFormat; filters: Record<string, unknown>; columns: string[]; }
export interface ExportJobState { id: string; status: "queued" | "running" | "done" | "failed"; requestedAt: Date; }
export function createExportJobRequest(tableId: string, format: ExportFormat, filters: Record<string, unknown>, columns: string[]): ExportJobRequest { return { tableId, format, filters, columns }; }
