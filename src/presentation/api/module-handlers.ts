import { getAppServices } from "./service-composition";

export const moduleHandlers = {
  dashboard: () => getAppServices().dashboard,
  reporting: () => getAppServices().reporting,
  accounting: () => getAppServices().accounting,
  chartOfAccounts: () => getAppServices().chartOfAccounts,
  arAp: () => getAppServices().arAp,
  cashManagement: () => getAppServices().cashManagement,
  float: () => getAppServices().float,
  inventory: () => getAppServices().inventory,
  business: () => getAppServices().business,
  revenue: () => getAppServices().revenue,
  tourism: () => getAppServices().tourism
} as const;
