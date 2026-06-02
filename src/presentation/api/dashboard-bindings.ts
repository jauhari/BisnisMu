import type { DashboardOverviewRequest } from "./contracts";
import { getAppServices } from "./service-composition";

export function getDashboardOverviewFromServices(request: DashboardOverviewRequest) { return getAppServices().dashboard.getDashboardOverview(request.range, request.input); }
