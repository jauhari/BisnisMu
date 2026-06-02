import { ReportingEngine } from "./domain/reporting-engine";

const defaultEngine = new ReportingEngine();

export { ReportingEngine } from "./domain/reporting-engine";
export { ReportingService } from "./application/reporting-service";
export type { LedgerRepository, ReportAuditEvent, ReportCommand, ReportingRepository } from "./application/reporting-repository";
export type * from "./domain/reporting-types";

export function generateProfitLoss(...args: Parameters<ReportingEngine["generateProfitLoss"]>): ReturnType<ReportingEngine["generateProfitLoss"]> {
  return defaultEngine.generateProfitLoss(...args);
}

export function generateBalanceSheet(...args: Parameters<ReportingEngine["generateBalanceSheet"]>): ReturnType<ReportingEngine["generateBalanceSheet"]> {
  return defaultEngine.generateBalanceSheet(...args);
}

export function generateCashFlow(...args: Parameters<ReportingEngine["generateCashFlow"]>): ReturnType<ReportingEngine["generateCashFlow"]> {
  return defaultEngine.generateCashFlow(...args);
}

export function generateTrialBalance(...args: Parameters<ReportingEngine["generateTrialBalance"]>): ReturnType<ReportingEngine["generateTrialBalance"]> {
  return defaultEngine.generateTrialBalance(...args);
}

export function generateGeneralLedger(...args: Parameters<ReportingEngine["generateGeneralLedger"]>): ReturnType<ReportingEngine["generateGeneralLedger"]> {
  return defaultEngine.generateGeneralLedger(...args);
}

export function generateSalesReport(...args: Parameters<ReportingEngine["generateSalesReport"]>): ReturnType<ReportingEngine["generateSalesReport"]> {
  return defaultEngine.generateSalesReport(...args);
}

export function generatePurchaseReport(...args: Parameters<ReportingEngine["generatePurchaseReport"]>): ReturnType<ReportingEngine["generatePurchaseReport"]> {
  return defaultEngine.generatePurchaseReport(...args);
}

export function generateInventoryReport(...args: Parameters<ReportingEngine["generateInventoryReport"]>): ReturnType<ReportingEngine["generateInventoryReport"]> {
  return defaultEngine.generateInventoryReport(...args);
}

export function generateFloatReport(...args: Parameters<ReportingEngine["generateFloatReport"]>): ReturnType<ReportingEngine["generateFloatReport"]> {
  return defaultEngine.generateFloatReport(...args);
}
