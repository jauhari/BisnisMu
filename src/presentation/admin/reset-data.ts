import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Reset data per-bisnis untuk God Mode (SUPER_ADMIN).
 *
 * Penghapusan dilakukan dalam SATU transaksi, mengikuti urutan tetap dari
 * tabel anak ke tabel induk (leaf -> root) supaya tidak melanggar foreign key
 * `onDelete: Restrict`. Jika subset yang dipilih melanggar dependency
 * (mis. hapus "Bagan Akun" tapi data transaksi masih ada), transaksi otomatis
 * di-rollback sehingga TIDAK ada data yang terhapus sebagian.
 */

export type ResetGroupKey =
  // Data transaksi
  | "journal"
  | "dailySales"
  | "cash"
  | "revenue"
  | "tourism"
  | "arap"
  | "salesPos"
  | "paymentWallet"
  | "float"
  | "inventory"
  | "cashSession"
  | "purchase"
  | "installments"
  | "beginningBalances"
  | "auditLogs"
  // Khusus (bukan hapus)
  | "loyaltyReset"
  // Master data (berisiko)
  | "paymentMethods"
  | "revenueMaster"
  | "tourismMaster"
  | "products"
  | "contacts"
  | "customersVendors"
  | "floatAccounts"
  | "posTerminalsDrawers"
  | "fiscalPeriods"
  | "accounts";

export type ResetCategory = "transaction" | "special" | "master";

export interface ResetGroupMeta {
  key: ResetGroupKey;
  label: string;
  description: string;
  category: ResetCategory;
  /** Grup lain yang WAJIB ikut dihapus (akan ditambahkan otomatis). */
  requires: ResetGroupKey[];
}

/** Metadata grup untuk ditampilkan di UI. Urutan = urutan tampil. */
export const RESET_GROUPS: ResetGroupMeta[] = [
  // ── Data transaksi ───────────────────────────────────────────────
  { key: "journal", category: "transaction", requires: [],
    label: "Jurnal & Buku Besar",
    description: "Semua jurnal dan baris jurnal. Inti yang ingin dikosongkan agar input ulang lewat Scan." },
  { key: "dailySales", category: "transaction", requires: [],
    label: "Penjualan Harian (Scan)",
    description: "Rekaman Scan Laporan Harian beserta rincian item & kontaknya." },
  { key: "cash", category: "transaction", requires: [],
    label: "Transaksi Kas Manual",
    description: "Kas masuk/keluar/transfer yang dicatat manual." },
  { key: "revenue", category: "transaction", requires: [],
    label: "Transaksi Pendapatan",
    description: "Transaksi pendapatan (revenue transactions)." },
  { key: "tourism", category: "transaction", requires: [],
    label: "Transaksi Kunjungan Wisata",
    description: "Transaksi pengunjung/tiket wisata." },
  { key: "arap", category: "transaction", requires: [],
    label: "Piutang & Utang (Invoice, Bill, Pembayaran)",
    description: "Invoice, bill, pembayaran, dan nota penyesuaian AR/AP." },
  { key: "salesPos", category: "transaction", requires: [],
    label: "Sales Order & POS",
    description: "Sales order beserta item, dan seluruh data sesi/transaksi POS." },
  { key: "paymentWallet", category: "transaction", requires: [],
    label: "Pembayaran & Wallet Pelanggan",
    description: "Payment transaction, alokasi, piutang (receivable), dan wallet/deposit pelanggan." },
  { key: "float", category: "transaction", requires: [],
    label: "Transaksi Float",
    description: "Top-up, konsumsi, transfer float, dan snapshot saldo float." },
  { key: "inventory", category: "transaction", requires: [],
    label: "Mutasi & Saldo Stok",
    description: "Pergerakan stok, saldo stok, dan histori biaya produk." },
  { key: "cashSession", category: "transaction", requires: [],
    label: "Sesi Kas (Shift)",
    description: "Sesi kas, pergerakan kas sesi, dan rekonsiliasi." },
  { key: "purchase", category: "transaction", requires: [],
    label: "Pembelian",
    description: "Purchase order, penerimaan, dan retur pembelian." },
  { key: "installments", category: "transaction", requires: [],
    label: "Cicilan",
    description: "Rencana cicilan dan jadwal angsuran." },
  { key: "beginningBalances", category: "transaction", requires: [],
    label: "Saldo Awal",
    description: "Saldo awal per akun per periode." },
  { key: "auditLogs", category: "transaction", requires: [],
    label: "Log Audit Bisnis",
    description: "Riwayat audit tenant untuk bisnis ini." },

  // ── Khusus ───────────────────────────────────────────────────────
  { key: "loyaltyReset", category: "special", requires: [],
    label: "Reset Saldo Loyalty Kontak",
    description: "Set kembali totalVisits, totalRevenue, dan loyaltyPoints kontak ke 0 (kontak TIDAK dihapus)." },

  // ── Master data (berisiko) ───────────────────────────────────────
  { key: "paymentMethods", category: "master", requires: [],
    label: "Metode Pembayaran",
    description: "Daftar metode pembayaran." },
  { key: "revenueMaster", category: "master", requires: ["revenue"],
    label: "Master Pendapatan (Kategori/Item/Paket/Harga)",
    description: "Kategori, item, paket, dan harga pendapatan. Membutuhkan penghapusan Transaksi Pendapatan." },
  { key: "tourismMaster", category: "master", requires: ["tourism"],
    label: "Master Wisata (Atraksi/Tiket/Parkir/Sewa)",
    description: "Atraksi, tipe tiket, paket, parkir, dan sewa. Membutuhkan penghapusan Transaksi Kunjungan." },
  { key: "products", category: "master", requires: ["inventory", "salesPos", "purchase", "paymentWallet", "paymentMethods"],
    label: "Produk & Kategori Produk",
    description: "Produk, harga produk, kategori, dan produk provider. Membutuhkan penghapusan data transaksi terkait stok/penjualan." },
  { key: "contacts", category: "master", requires: ["cash", "dailySales"],
    label: "Kontak",
    description: "Daftar kontak. Membutuhkan penghapusan Transaksi Kas & Penjualan Harian yang memakai kontak." },
  { key: "customersVendors", category: "master", requires: ["arap", "salesPos", "paymentWallet", "purchase"],
    label: "Pelanggan & Vendor",
    description: "Master pelanggan dan vendor. Membutuhkan penghapusan AR/AP, Sales/POS, Pembayaran, dan Pembelian." },
  { key: "floatAccounts", category: "master", requires: ["float", "products", "paymentMethods", "paymentWallet"],
    label: "Akun Float",
    description: "Akun float provider. Membutuhkan penghapusan transaksi float, produk provider, dan metode pembayaran." },
  { key: "posTerminalsDrawers", category: "master", requires: ["salesPos", "cashSession"],
    label: "Terminal POS & Laci Kas",
    description: "Terminal POS dan laci kas. Membutuhkan penghapusan sesi POS & sesi kas." },
  { key: "fiscalPeriods", category: "master", requires: ["journal", "beginningBalances"],
    label: "Periode Fiskal",
    description: "Periode/tahun buku. Membutuhkan penghapusan Jurnal & Saldo Awal." },
  { key: "accounts", category: "master", requires: [
      "journal", "dailySales", "cash", "revenue", "tourism", "arap", "salesPos",
      "paymentWallet", "float", "inventory", "cashSession", "purchase", "installments",
      "beginningBalances", "paymentMethods", "revenueMaster", "tourismMaster", "products",
      "floatAccounts", "customersVendors", "posTerminalsDrawers", "fiscalPeriods",
    ],
    label: "Bagan Akun (Chart of Accounts)",
    description: "Menghapus SELURUH bagan akun. Otomatis menghapus hampir semua data bisnis lain karena akun menjadi acuan semua transaksi." },
];

const GROUP_BY_KEY = new Map(RESET_GROUPS.map((g) => [g.key, g]));

export function isValidGroup(key: string): key is ResetGroupKey {
  return GROUP_BY_KEY.has(key as ResetGroupKey);
}

/** Tambahkan semua grup prasyarat secara transitif. */
export function expandGroups(selected: ResetGroupKey[]): ResetGroupKey[] {
  const result = new Set<ResetGroupKey>();
  const stack = [...selected];
  while (stack.length) {
    const key = stack.pop()!;
    if (result.has(key)) continue;
    result.add(key);
    const meta = GROUP_BY_KEY.get(key);
    if (meta) stack.push(...meta.requires);
  }
  return [...result];
}

type Tx = Prisma.TransactionClient;

interface ResetStep {
  group: ResetGroupKey;
  /** Nama tabel untuk pelaporan jumlah baris terhapus; null untuk langkah persiapan. */
  table: string | null;
  run: (tx: Tx, businessId: string) => Promise<number>;
}

const del = (group: ResetGroupKey, table: string, fn: (tx: Tx, businessId: string) => Promise<{ count: number }>): ResetStep => ({
  group,
  table,
  run: async (tx, businessId) => (await fn(tx, businessId)).count,
});

const prep = (group: ResetGroupKey, fn: (tx: Tx, businessId: string) => Promise<{ count: number }>): ResetStep => ({
  group,
  table: null,
  run: async (tx, businessId) => { await fn(tx, businessId); return 0; },
});

const W = (businessId: string) => ({ where: { businessId } });

/**
 * Urutan eksekusi global (leaf -> root). Hanya langkah yang grup-nya terpilih
 * yang dijalankan, tetapi tetap dalam urutan ini agar FK aman.
 */
const STEPS: ResetStep[] = [
  // journal (lepas self-reference reversedById dulu)
  prep("journal", (tx, b) => tx.journalEntry.updateMany({ where: { businessId: b, reversedById: { not: null } }, data: { reversedById: null } })),
  del("journal", "journal_lines", (tx, b) => tx.journalLine.deleteMany(W(b))),
  del("journal", "journal_entries", (tx, b) => tx.journalEntry.deleteMany(W(b))),

  // daily sales (cascade ke items + contacts)
  del("dailySales", "daily_sales", (tx, b) => tx.dailySale.deleteMany(W(b))),

  del("cash", "cash_transactions", (tx, b) => tx.cashTransaction.deleteMany(W(b))),
  del("revenue", "revenue_transactions", (tx, b) => tx.revenueTransaction.deleteMany(W(b))),
  del("tourism", "visitor_transactions", (tx, b) => tx.visitorTransaction.deleteMany(W(b))),

  // AR/AP
  del("arap", "adjustment_notes", (tx, b) => tx.adjustmentNote.deleteMany(W(b))),
  del("arap", "payments", (tx, b) => tx.payment.deleteMany(W(b))),
  del("arap", "invoices", (tx, b) => tx.invoice.deleteMany(W(b))),
  del("arap", "bills", (tx, b) => tx.bill.deleteMany(W(b))),

  // Sales & POS
  del("salesPos", "pos_receipts", (tx, b) => tx.posReceiptRecord.deleteMany(W(b))),
  del("salesPos", "pos_cart_items", (tx, b) => tx.posCartItem.deleteMany(W(b))),
  del("salesPos", "pos_transactions", (tx, b) => tx.posTransactionRecord.deleteMany(W(b))),
  del("salesPos", "pos_sessions", (tx, b) => tx.posSessionRecord.deleteMany(W(b))),
  del("salesPos", "sales_order_items", (tx, b) => tx.salesOrderItem.deleteMany(W(b))),
  del("salesPos", "sales_orders", (tx, b) => tx.salesOrder.deleteMany(W(b))),

  // Payment & wallet
  del("paymentWallet", "payment_allocations", (tx, b) => tx.paymentAllocation.deleteMany(W(b))),
  del("paymentWallet", "receivables", (tx, b) => tx.receivable.deleteMany(W(b))),
  del("paymentWallet", "payment_transactions", (tx, b) => tx.paymentTransaction.deleteMany(W(b))),
  del("paymentWallet", "customer_wallet_transactions", (tx, b) => tx.customerWalletTransaction.deleteMany(W(b))),
  del("paymentWallet", "customer_wallets", (tx, b) => tx.customerWallet.deleteMany(W(b))),

  // Float tx
  del("float", "float_balance_snapshots", (tx, b) => tx.floatBalanceSnapshot.deleteMany(W(b))),
  del("float", "float_transactions", (tx, b) => tx.floatTransaction.deleteMany(W(b))),

  // Inventory tx
  del("inventory", "inventory_movements", (tx, b) => tx.inventoryMovement.deleteMany(W(b))),
  del("inventory", "inventory_balances", (tx, b) => tx.inventoryBalance.deleteMany(W(b))),
  del("inventory", "product_cost_histories", (tx, b) => tx.productCostHistory.deleteMany(W(b))),

  // Cash session
  del("cashSession", "cash_reconciliations", (tx, b) => tx.cashReconciliationRecord.deleteMany(W(b))),
  del("cashSession", "cash_movements", (tx, b) => tx.cashMovementRecord.deleteMany(W(b))),
  del("cashSession", "cash_sessions", (tx, b) => tx.cashSessionRecord.deleteMany(W(b))),

  // Purchase
  del("purchase", "purchase_returns", (tx, b) => tx.purchaseReturn.deleteMany(W(b))),
  del("purchase", "purchase_receipts", (tx, b) => tx.purchaseReceipt.deleteMany(W(b))),
  del("purchase", "purchase_order_items", (tx, b) => tx.purchaseOrderItem.deleteMany(W(b))),
  del("purchase", "purchase_orders", (tx, b) => tx.purchaseOrder.deleteMany(W(b))),

  // Installments (schedule cascade dari plan, tetap hapus eksplisit dulu)
  del("installments", "installment_schedules", (tx, b) => tx.installmentSchedule.deleteMany(W(b))),
  del("installments", "installment_plans", (tx, b) => tx.installmentPlan.deleteMany(W(b))),

  del("beginningBalances", "beginning_balances", (tx, b) => tx.beginningBalance.deleteMany(W(b))),
  del("auditLogs", "audit_logs", (tx, b) => tx.auditLog.deleteMany(W(b))),

  // Khusus: reset loyalty (update, bukan delete)
  prep("loyaltyReset", (tx, b) => tx.contact.updateMany({ where: { businessId: b }, data: { totalVisits: 0, totalRevenue: 0n, loyaltyPoints: 0 } })),

  // ── Master data ─────────────────────────────────────────────────
  del("paymentMethods", "payment_methods", (tx, b) => tx.paymentMethod.deleteMany(W(b))),

  del("revenueMaster", "revenue_pricings", (tx, b) => tx.revenuePricing.deleteMany(W(b))),
  del("revenueMaster", "revenue_items", (tx, b) => tx.revenueItem.deleteMany(W(b))),
  del("revenueMaster", "revenue_packages", (tx, b) => tx.revenuePackage.deleteMany(W(b))),
  del("revenueMaster", "revenue_categories", (tx, b) => tx.revenueCategory.deleteMany(W(b))),

  del("tourismMaster", "ticket_types", (tx, b) => tx.ticketType.deleteMany(W(b))),
  del("tourismMaster", "ticket_packages", (tx, b) => tx.ticketPackage.deleteMany(W(b))),
  del("tourismMaster", "parking_services", (tx, b) => tx.parkingService.deleteMany(W(b))),
  del("tourismMaster", "rental_services", (tx, b) => tx.rentalService.deleteMany(W(b))),
  del("tourismMaster", "tenant_rentals", (tx, b) => tx.tenantRental.deleteMany(W(b))),
  del("tourismMaster", "attractions", (tx, b) => tx.attraction.deleteMany(W(b))),

  del("products", "provider_products", (tx, b) => tx.providerProduct.deleteMany(W(b))),
  del("products", "product_prices", (tx, b) => tx.productPrice.deleteMany(W(b))),
  del("products", "products", (tx, b) => tx.product.deleteMany(W(b))),
  prep("products", (tx, b) => tx.productCategory.updateMany({ where: { businessId: b, parentId: { not: null } }, data: { parentId: null } })),
  del("products", "product_categories", (tx, b) => tx.productCategory.deleteMany(W(b))),

  del("contacts", "contacts", (tx, b) => tx.contact.deleteMany(W(b))),

  del("customersVendors", "customers", (tx, b) => tx.customer.deleteMany(W(b))),
  del("customersVendors", "vendors", (tx, b) => tx.vendor.deleteMany(W(b))),

  del("floatAccounts", "float_accounts", (tx, b) => tx.floatAccount.deleteMany(W(b))),

  del("posTerminalsDrawers", "pos_terminals", (tx, b) => tx.posTerminal.deleteMany(W(b))),
  del("posTerminalsDrawers", "cash_drawers", (tx, b) => tx.cashDrawer.deleteMany(W(b))),

  del("fiscalPeriods", "fiscal_periods", (tx, b) => tx.fiscalPeriod.deleteMany(W(b))),

  // Accounts (lepas self-reference parentId dulu)
  prep("accounts", (tx, b) => tx.account.updateMany({ where: { businessId: b, parentId: { not: null } }, data: { parentId: null } })),
  del("accounts", "accounts", (tx, b) => tx.account.deleteMany(W(b))),
];

export interface ResetResult {
  /** Grup yang benar-benar dieksekusi (termasuk hasil auto-expand). */
  executedGroups: ResetGroupKey[];
  /** Jumlah baris terhapus per tabel (tabel dengan 0 baris tetap dicantumkan jika langkahnya jalan). */
  deletedByTable: Record<string, number>;
  totalDeleted: number;
  /** true bila ini hanya pratinjau (data di-rollback, tidak benar-benar dihapus). */
  dryRun: boolean;
}

/** Sentinel internal untuk memaksa rollback transaksi saat dry-run. */
class PreviewRollback extends Error {
  constructor() { super("__PREVIEW_ROLLBACK__"); this.name = "PreviewRollback"; }
}

/**
 * Jalankan reset data untuk satu bisnis. Atomik: semua-atau-tidak sama sekali.
 *
 * Dengan `dryRun: true`, seluruh langkah dijalankan di dalam transaksi lalu
 * di-rollback, sehingga jumlah baris yang dilaporkan PERSIS sama dengan yang
 * akan terhapus pada eksekusi nyata — termasuk akan memunculkan error FK bila
 * subset grup tidak konsisten — tanpa benar-benar menghapus data.
 *
 * @throws bila terjadi pelanggaran FK (subset grup tidak konsisten) — transaksi rollback.
 */
export async function resetBusinessData(
  prisma: PrismaClient,
  businessId: string,
  selected: ResetGroupKey[],
  opts: { dryRun?: boolean } = {},
): Promise<ResetResult> {
  const dryRun = opts.dryRun === true;
  const executed = new Set(expandGroups(selected));
  const steps = STEPS.filter((s) => executed.has(s.group));

  const deletedByTable: Record<string, number> = {};
  let totalDeleted = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const step of steps) {
        const count = await step.run(tx, businessId);
        if (step.table) {
          deletedByTable[step.table] = count;
          totalDeleted += count;
        }
      }
      // Pratinjau: batalkan semua perubahan setelah menghitung.
      if (dryRun) throw new PreviewRollback();
    }, {
      // Reset bisa menyentuh banyak tabel; beri waktu cukup untuk DB remote (Neon).
      maxWait: 15_000,
      timeout: 120_000,
    });
  } catch (err) {
    if (!(err instanceof PreviewRollback)) throw err;
    // PreviewRollback => sukses, transaksi sudah di-rollback otomatis.
  }

  return {
    executedGroups: [...executed],
    deletedByTable,
    totalDeleted,
    dryRun,
  };
}
