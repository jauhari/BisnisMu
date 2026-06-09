export function formatMoney(value: bigint | number, currency = "IDR"): string {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(numeric);
}
/** Pemisah ribuan gaya Indonesia tanpa simbol mata uang (10000 → "10.000"). Aman untuk string angka mentah; nilai non-numerik dikembalikan apa adanya. */
export function formatNumber(value: bigint | number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const numeric = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(numeric);
}
/** Format Rupiah dari nilai apa pun (string/number/bigint). Nilai kosong → "-". */
export function formatRupiah(value: bigint | number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric === "number" && !Number.isFinite(numeric)) return "-";
  return formatMoney(numeric as number | bigint);
}
export function formatPercent(value: number): string { return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 2 }).format(value / 100); }
export function formatDate(value: Date): string { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(value); }

/** Tanggal panjang gaya Indonesia: "9 Juni 2026" (TANGGAL NAMA BULAN TAHUN). Terima Date atau string "YYYY-MM-DD". */
export function formatDateLong(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value.length <= 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Tanggal + waktu panjang: "9 Juni 2026, 09.00". */
export function formatDateTimeLong(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
