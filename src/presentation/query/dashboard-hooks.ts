"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardOverviewRequest, DashboardOverviewResponse, ReportRequest, ProfitLossResponse, CashFlowResponse, GeneralLedgerResponse, TrialBalanceResponse, BalanceSheetResponse } from "@/presentation/api/contracts";
import { apiRequest } from "@/presentation/api/client";
import { queryKeys } from "@/presentation/query/keys";

function rangeKey(startsOn: Date, endsOn: Date): string { return startsOn.toISOString() + ':' + endsOn.toISOString(); }

export function useDashboardOverview(request: DashboardOverviewRequest) {
  return useQuery({ queryKey: queryKeys.dashboard(request.range.businessId, rangeKey(request.range.startsOn, request.range.endsOn)), queryFn: () => apiRequest<DashboardOverviewResponse>("/api/dashboard/overview", { method: "POST", body: JSON.stringify(request) }) });
}

export function useGeneralLedgerReport(request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, "general-ledger", rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<GeneralLedgerResponse>("/api/reports/general-ledger", { method: "POST", body: JSON.stringify(request) }) });
}

export function useTrialBalanceReport(request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, "trial-balance", rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<TrialBalanceResponse>("/api/reports/trial-balance", { method: "POST", body: JSON.stringify(request) }) });
}

export function useProfitLossReport(request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, "profit-loss", rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<ProfitLossResponse>("/api/reports/profit-loss", { method: "POST", body: JSON.stringify(request) }) });
}

export function useBalanceSheetReport(request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, "balance-sheet", rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<BalanceSheetResponse>("/api/reports/balance-sheet", { method: "POST", body: JSON.stringify(request) }) });
}

export function useCashFlowReport(request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, "cash-flow", rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<CashFlowResponse>("/api/reports/cash-flow", { method: "POST", body: JSON.stringify(request) }) });
}

export function useOperationalReport<T>(path: string, reportName: string, request: ReportRequest) {
  const command = request.command;
  return useQuery({ queryKey: queryKeys.report(command.businessId, reportName, rangeKey(command.startsOn ?? new Date(0), command.endsOn ?? new Date(0))), queryFn: () => apiRequest<{ data: T }>(path, { method: "POST", body: JSON.stringify(request) }) });
}

export function useListQuery<T>(path: string, key: readonly unknown[]) {
  return useQuery({ queryKey: key, queryFn: () => apiRequest<{ data: T }>(path) });
}

export function usePostMutation<TPayload extends object, TResult = unknown>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => apiRequest<TResult>(path, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["list"] }); },
  });
}

export function usePatchMutation<TPayload extends object, TResult = unknown>(pathFor: (payload: TPayload) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TPayload) => apiRequest<TResult>(pathFor(payload), { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["list"] }); },
  });
}
