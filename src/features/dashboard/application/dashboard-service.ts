import { DashboardEngine } from "../domain/dashboard-engine";
import { DashboardDateRange, DashboardInput } from "../domain/dashboard-types";

export class DashboardService {
  constructor(private readonly engine = new DashboardEngine()) {}
  getDashboardOverview(range: DashboardDateRange, input: DashboardInput) { return this.engine.getDashboardOverview(range, input); }
  getSalesAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getSalesAnalytics(range, input); }
  getInventoryAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getInventoryAnalytics(range, input); }
  getCashAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getCashAnalytics(range, input); }
  getFloatAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getFloatAnalytics(range, input); }
  getCustomerAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getCustomerAnalytics(range, input); }
  getVendorAnalytics(range: DashboardDateRange, input: DashboardInput) { return this.engine.getVendorAnalytics(range, input); }
}
