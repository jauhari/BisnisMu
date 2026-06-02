export function formatMoney(value: bigint | number, currency = "IDR"): string {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(numeric);
}
export function formatPercent(value: number): string { return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 2 }).format(value / 100); }
export function formatDate(value: Date): string { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(value); }
