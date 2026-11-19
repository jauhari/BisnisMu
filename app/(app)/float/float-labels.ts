import { formatRupiah } from "@/presentation/format/number";

// Label ramah pengguna untuk enum FloatProvider di prisma/schema.prisma.
export const PROVIDER_LABELS: Record<string, string> = {
  BUKUWARUNG: "BukuWarung",
  FASTPAY: "FastPay",
  PAYFAZZ: "Payfazz",
  SHOPEEPAY: "ShopeePay",
  LINKAJA: "LinkAja",
  CUSTOM: "Lainnya",
};

export const PROVIDER_OPTIONS = Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label }));

export function providerLabel(provider: unknown): string {
  return PROVIDER_LABELS[String(provider ?? "")] ?? String(provider ?? "-");
}

export function floatAccountLabel(account: any): string {
  return `${account.name} (${providerLabel(account.provider)})`;
}

export function flattenAccounts(nodes: any[]): any[] {
  return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]);
}

export type FloatTransactionRow = { number: string; account: string; date: string; amount: string; balance: string };

/** Ubah daftar transaksi rekanan jadi baris tabel, hanya untuk satu jenis transaksi. */
export function buildTransactionRows(transactions: any[], floats: any[], type: "TOPUP" | "CONSUME" | "TRANSFER" | "ADJUSTMENT"): FloatTransactionRow[] {
  const byId = new Map(floats.map((f: any) => [f.id, f]));
  return transactions
    .filter((t: any) => t.type === type)
    .map((t: any) => {
      const source = byId.get(t.floatAccountId);
      const destination = t.destinationFloatAccountId ? byId.get(t.destinationFloatAccountId) : undefined;
      const sourceName = source ? floatAccountLabel(source) : "-";
      return {
        number: t.transactionNumber,
        account: destination ? `${sourceName} → ${floatAccountLabel(destination)}` : sourceName,
        date: t.transactionDate?.slice?.(0, 10) ?? t.transactionDate,
        amount: formatRupiah(t.amount),
        balance: formatRupiah(t.balanceAfter),
      };
    });
}

export const TRANSACTION_COLUMNS = [
  { key: "number", header: "Nomor" },
  { key: "account", header: "Rekanan" },
  { key: "date", header: "Tanggal" },
  { key: "amount", header: "Nominal" },
  { key: "balance", header: "Saldo akhir" },
];

export const LOAD_ERROR_DESCRIPTION = "Data saldo rekanan tidak bisa dimuat. Coba muat ulang halaman.";
