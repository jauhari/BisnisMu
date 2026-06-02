import type { ReportCommand } from "../../features/reporting/application/reporting-repository";
import { getAppServices } from "./service-composition";

export function generateGeneralLedgerFromServices(command: ReportCommand) { return getAppServices().reporting.generateGeneralLedger(command); }
export function generateTrialBalanceFromServices(command: ReportCommand) { return getAppServices().reporting.generateTrialBalance(command); }
export function generateProfitLossFromServices(command: ReportCommand) { return getAppServices().reporting.generateProfitLoss(command); }
export function generateBalanceSheetFromServices(command: ReportCommand) { return getAppServices().reporting.generateBalanceSheet(command); }
export function generateCashFlowFromServices(command: ReportCommand) { return getAppServices().reporting.generateCashFlow(command); }
