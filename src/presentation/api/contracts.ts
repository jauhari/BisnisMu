import type { DashboardDateRange, DashboardInput, DashboardOverview } from "../../features/dashboard";
import type { ReportCommand } from "../../features/reporting/application/reporting-repository";
import type { BalanceSheetReport, CashFlowReport, GeneralLedgerReport, ProfitAndLossReport, TrialBalanceReport } from "../../features/reporting";

export interface ApiEnvelope<T> { data: T; meta?: { requestId?: string; generatedAt: string }; }
export interface ApiProblem { code: string; message: string; details?: Record<string, unknown>; }

export interface DashboardOverviewRequest { range: DashboardDateRange; input: DashboardInput; }
export type DashboardOverviewResponse = ApiEnvelope<DashboardOverview>;

export interface ReportRequest { command: ReportCommand; }
export type GeneralLedgerResponse = ApiEnvelope<GeneralLedgerReport>;
export type TrialBalanceResponse = ApiEnvelope<TrialBalanceReport>;
export type ProfitLossResponse = ApiEnvelope<ProfitAndLossReport>;
export type BalanceSheetResponse = ApiEnvelope<BalanceSheetReport>;
export type CashFlowResponse = ApiEnvelope<CashFlowReport>;

export type ApiModule = "business" | "accounting" | "chart-of-accounts" | "cash" | "ar-ap" | "payment" | "float" | "inventory" | "purchase" | "sales" | "pos" | "reports" | "dashboard";
