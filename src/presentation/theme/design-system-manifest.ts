export interface DesignSystemComponentSpec { name: string; category: "surface" | "overlay" | "input" | "feedback" | "data" | "navigation" | "analytics"; nativeUiAllowed: false; purpose: string; }

export const designSystemComponents: DesignSystemComponentSpec[] = [
  { name: "GlassCard", category: "surface", nativeUiAllowed: false, purpose: "Atomic glass card surface." },
  { name: "GlassPanel", category: "surface", nativeUiAllowed: false, purpose: "Section-level glass panel." },
  { name: "GlassModal", category: "overlay", nativeUiAllowed: false, purpose: "Custom modal shell replacing native modal/alert/confirm." },
  { name: "GlassDialog", category: "overlay", nativeUiAllowed: false, purpose: "Decision dialog with focus management." },
  { name: "GlassDrawer", category: "overlay", nativeUiAllowed: false, purpose: "Side drawer for details and source tracing." },
  { name: "GlassSheet", category: "overlay", nativeUiAllowed: false, purpose: "Responsive sheet surface." },
  { name: "GlassPopover", category: "overlay", nativeUiAllowed: false, purpose: "Floating contextual surface." },
  { name: "GlassTooltip", category: "feedback", nativeUiAllowed: false, purpose: "Custom tooltip surface." },
  { name: "GlassDropdown", category: "input", nativeUiAllowed: false, purpose: "Custom dropdown menu." },
  { name: "GlassSelect", category: "input", nativeUiAllowed: false, purpose: "Custom select replacing native select." },
  { name: "GlassMultiSelect", category: "input", nativeUiAllowed: false, purpose: "Custom multi-select." },
  { name: "GlassCombobox", category: "input", nativeUiAllowed: false, purpose: "Searchable async picker." },
  { name: "GlassDatePicker", category: "input", nativeUiAllowed: false, purpose: "Custom date picker replacing native date input." },
  { name: "GlassDateRangePicker", category: "input", nativeUiAllowed: false, purpose: "Custom date range picker." },
  { name: "GlassDateTimePicker", category: "input", nativeUiAllowed: false, purpose: "Custom date-time picker." },
  { name: "GlassTimePicker", category: "input", nativeUiAllowed: false, purpose: "Custom time picker." },
  { name: "GlassFileUploader", category: "input", nativeUiAllowed: false, purpose: "Custom file upload interaction." },
  { name: "GlassNotificationCenter", category: "feedback", nativeUiAllowed: false, purpose: "Notification center." },
  { name: "GlassToast", category: "feedback", nativeUiAllowed: false, purpose: "Custom toast notification." },
  { name: "GlassContextMenu", category: "overlay", nativeUiAllowed: false, purpose: "Custom context menu." },
  { name: "GlassCommandPalette", category: "navigation", nativeUiAllowed: false, purpose: "Global command surface." },
  { name: "GlassTable", category: "data", nativeUiAllowed: false, purpose: "Enterprise data grid shell." },
  { name: "GlassForm", category: "input", nativeUiAllowed: false, purpose: "Form layout with custom validation surfaces." },
  { name: "GlassTabs", category: "navigation", nativeUiAllowed: false, purpose: "Custom tab control." },
  { name: "GlassStatsCard", category: "analytics", nativeUiAllowed: false, purpose: "Stats display." },
  { name: "GlassMetricCard", category: "analytics", nativeUiAllowed: false, purpose: "Metric display." },
  { name: "GlassChartCard", category: "analytics", nativeUiAllowed: false, purpose: "Chart container." },
  { name: "GlassKpiCard", category: "analytics", nativeUiAllowed: false, purpose: "KPI card." }
];

export function componentSpec(name: string): DesignSystemComponentSpec | undefined { return designSystemComponents.find((component) => component.name === name); }
