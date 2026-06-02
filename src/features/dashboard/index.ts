import { DashboardEngine } from "./domain/dashboard-engine";

const defaultEngine = new DashboardEngine();

export { DashboardEngine } from "./domain/dashboard-engine";
export { DashboardService } from "./application/dashboard-service";
export type * from "./domain/dashboard-types";

export function getDashboardOverview(...args: Parameters<DashboardEngine["getDashboardOverview"]>): ReturnType<DashboardEngine["getDashboardOverview"]> { return defaultEngine.getDashboardOverview(...args); }
export function getSalesAnalytics(...args: Parameters<DashboardEngine["getSalesAnalytics"]>): ReturnType<DashboardEngine["getSalesAnalytics"]> { return defaultEngine.getSalesAnalytics(...args); }
export function getInventoryAnalytics(...args: Parameters<DashboardEngine["getInventoryAnalytics"]>): ReturnType<DashboardEngine["getInventoryAnalytics"]> { return defaultEngine.getInventoryAnalytics(...args); }
export function getCashAnalytics(...args: Parameters<DashboardEngine["getCashAnalytics"]>): ReturnType<DashboardEngine["getCashAnalytics"]> { return defaultEngine.getCashAnalytics(...args); }
export function getFloatAnalytics(...args: Parameters<DashboardEngine["getFloatAnalytics"]>): ReturnType<DashboardEngine["getFloatAnalytics"]> { return defaultEngine.getFloatAnalytics(...args); }
export function getCustomerAnalytics(...args: Parameters<DashboardEngine["getCustomerAnalytics"]>): ReturnType<DashboardEngine["getCustomerAnalytics"]> { return defaultEngine.getCustomerAnalytics(...args); }
export function getVendorAnalytics(...args: Parameters<DashboardEngine["getVendorAnalytics"]>): ReturnType<DashboardEngine["getVendorAnalytics"]> { return defaultEngine.getVendorAnalytics(...args); }
