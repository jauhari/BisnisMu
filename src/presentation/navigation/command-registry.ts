import { navigation } from "./navigation";
import { uiModuleRegistry } from "../modules/ui-registry";

export interface CommandItem { id: string; label: string; href?: string; group: string; keywords: string[]; }

function flattenNavigation(): CommandItem[] {
  return navigation.flatMap((item) => [{ id: item.href, label: item.title, href: item.href, group: "Navigation", keywords: [item.title] }, ...(item.children ?? []).map((child) => ({ id: child.href, label: child.title, href: child.href, group: item.title, keywords: [item.title, child.title] }))]);
}

function moduleCommands(): CommandItem[] {
  return uiModuleRegistry.flatMap((module) => [
    ...module.forms.map((name) => ({ id: module.id + ":form:" + name, label: name, group: module.title + " Forms", keywords: [module.title, name, module.backendService] })),
    ...module.tables.map((name) => ({ id: module.id + ":table:" + name, label: name, group: module.title + " Tables", keywords: [module.title, name, module.backendService] })),
    ...module.reports.map((name) => ({ id: module.id + ":report:" + name, label: name, group: module.title + " Reports", keywords: [module.title, name, module.backendService] }))
  ]);
}

export const commandRegistry: CommandItem[] = [...flattenNavigation(), ...moduleCommands()];

export function searchCommands(term: string): CommandItem[] {
  const query = term.trim().toLowerCase();
  if (!query) return commandRegistry.slice(0, 20);
  return commandRegistry.filter((item) => [item.label, item.group, ...item.keywords].some((value) => value.toLowerCase().includes(query))).slice(0, 30);
}
