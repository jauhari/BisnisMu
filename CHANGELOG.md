# Changelog

All notable changes to BisnisMu are documented in this file.

## [0.10.0] - 2026-06-10

### Added — CRUD Transaksi Berbasis Role dan Setting Organisasi
- Halaman `Riwayat Transaksi` baru menggabungkan Penjualan Harian, Sales Order, dan Transaksi Kas dalam satu tabel operasional.
- Aksi `Edit`, `Delete`, `Void`, `Post`, dan `Confirm` mengikuti role user dan status transaksi.
- Setting organisasi baru `transactionHardMutationEnabled` memungkinkan organisasi tertentu mengaktifkan edit/delete langsung untuk role di atas Cashier.
- Bisnis Hanyukupi dapat memakai mode edit/delete langsung untuk transaksi yang sudah posted/confirmed tanpa alur void, dengan audit tetap tercatat.
- API baru untuk riwayat transaksi, update/delete sales order, update/delete penjualan harian, update/delete transaksi kas, dan setting hard mutation organisasi.

### Changed — UI/UX Penjualan, Tabel, dan CoA Query
- Form `Penjualan Harian` kini default tersembunyi dan dibuka lewat tombol `Tambah penjualan`; saat edit dari tabel, form otomatis terbuka.
- Layout form penjualan dipadatkan: tanggal dibuat ringkas, akun/keterangan mendapat ruang lebih proporsional, dan total tampil di header form.
- `GlassDataSelect` otomatis berubah menjadi query field cerdas untuk pilihan akun CoA: daftar tidak muncul sebelum user mengetik, hasil dibatasi maksimal 5 akun, dan bisa dicari lewat nama/kode/grup akun.
- Tabel data memformat akun CoA dengan fokus pada nama akun, sementara kode akun tampil kecil sebagai metadata di kanan.
- Tabel data memformat tanggal ke format lokal Indonesia dan memberi warna grup per tanggal agar perbedaan tanggal lebih mudah dipindai.
- Layout workspace dan tabel dibuat lebih nyaman di layar kecil: panel samping turun ke bawah, filter dapat membungkus, dan scroll horizontal dibatasi di area tabel.
- Kolom nomor internal panjang di Riwayat Transaksi disembunyikan agar tabel lebih fokus pada tanggal, status, keterangan, nominal, dan aksi.

## [0.9.0] - 2026-06-09

### Added — Jurnal Draft, Reversal, dan Koreksi Standar Akuntansi
- Jurnal manual kini mendukung alur `DRAFT` → `POSTED`; draft bisa diedit/dihapus, sedangkan jurnal posted terkunci.
- Koreksi jurnal posted dilakukan lewat aksi `Reverse` yang membuat jurnal pembalik, lalu user bisa `Copy` untuk membuat jurnal koreksi baru.
- Migration `20260609090000_add_journal_drafts` menambahkan status `DRAFT` pada `JournalStatus`.
- API baru: `/api/accounting/journals/drafts`, `/api/accounting/journals/drafts/:journalId`, `/api/accounting/journals/:journalId/post`, dan `/api/accounting/journals/:journalId/reverse`.

### Changed — UI/UX Jurnal dan Tabel Data
- Form jurnal manual kini tersembunyi di drawer dan hanya muncul lewat tombol `Tambah jurnal manual`, sehingga tabel jurnal lebih lega untuk review data.
- Halaman kas kini difokuskan menjadi `Pengeluaran Kas` untuk biaya operasional harian; transaksi otomatis dibuat sebagai `CASH_OUT` dan langsung diposting ke jurnal.
- Form jurnal memakai date picker ringkas, amount auto-format ribuan Indonesia, serta warna debit/kredit yang lebih informatif.
- Dropdown akun dibuat lebih bersih: nama akun sebagai fokus, metadata grup/saldo normal ringkas, tanpa kode akun yang terlalu dominan.
- Tabel data mendapat zebra row, header lebih kuat, hover row, selected state, dan opsi `selectable={false}` untuk halaman yang tidak punya bulk action.
- Date input pembelian dan filter laporan memakai glass date/date-range picker, dengan format tanggal Indonesia konsisten.

### Changed — Bagan Akun (CoA) Lebih Hierarkis
- Halaman CoA kini menampilkan struktur akun sebagai tree dengan indent level, status `Header`/`Posting`, badge grup, dan kode akun sebagai metadata kanan.
- Akun header diberi background dan penanda kiri yang lebih tegas agar struktur kategori terlihat jelas.
- CoA kini mendukung aksi edit nama akun, aktif/nonaktif, dan hapus/deaktif melalui route akun per-ID.
- Form CoA dilokalkan ke Bahasa Indonesia dan mendukung pembuatan akun header maupun akun posting.
- Kode akun dibuat otomatis berdasarkan grup, induk akun, dan nomor terakhir yang sudah ada; saldo normal ditampilkan sebagai informasi read-only.
## [0.8.0] - 2026-06-09

### Added — Multi-Unit Organization (Hierarki Organisasi → Unit Usaha)
- Layer additive di atas model flat: `Organization` (lembaga induk: BUMDes/Koperasi/Holding/Waralaba) menaungi beberapa `Business` (unit usaha). Satu Business hanya milik satu Organization.
- Schema baru: enum `OrgType`, `OrgRole`; model `Organization`, `OrgMember`; kolom nullable `organizationId` di `Business` (migration `202606090001_add_organization_layer`). Tidak ada perubahan breaking — semua data & kode existing tetap valid.
- Peran organisasi `ORG_OWNER`/`ORG_ADMIN`/`ORG_VIEWER` dengan cascade ke unit (OWNER/ADMIN → ADMIN, VIEWER → VIEWER). Proteksi "ORG_OWNER terakhir".
- **Laporan konsolidasi** (agregasi langsung, tanpa eliminasi antar unit): laba rugi & neraca gabungan + perbandingan antar unit dengan skor kesehatan (🟢 ≥30%, 🟡 10–30%, 🔴 <10%/rugi).
- API baru `/api/organizations/*`: CRUD organisasi, attach/detach unit, kelola anggota, dan `reports/{profit-loss,balance-sheet,unit-comparison}` + `dashboard`. `ReportingService` existing dipakai apa adanya (zero perubahan).
- Fitur baru: `src/features/organization/` (domain/application/infrastructure), `orgServices` di `server-services.ts`, halaman `/organizations` & `/organizations/[orgId]`.
- Tests: `tests/organization/` (engine + consolidation service).

### Changed — Switch Bisnis Terintegrasi di Header
- Pemilih "Usaha aktif" di header kini berupa **dropdown inline** (`BusinessSwitcher`) — ganti usaha langsung tanpa pindah ke halaman `/select-business`. Menandai usaha aktif, ada "+ Buat usaha baru", invalidasi cache + refresh otomatis setelah ganti.

## [0.7.0] - 2026-06-09

### Added — God Mode: Reset Data Bisnis
- Menu baru **Admin (God Mode) → Reset Data** (`/admin/reset`) untuk mereset data per bisnis. Hanya `SUPER_ADMIN`.
- Reset granular per kategori: data transaksi (Jurnal & Buku Besar, Penjualan Harian/Scan, Kas, Pendapatan, Wisata, AR/AP, Sales & POS, Pembayaran & Wallet, Float, Stok, Sesi Kas, Pembelian, Cicilan, Saldo Awal, Log Audit), khusus (reset saldo loyalty kontak), dan master data (Metode Pembayaran, Master Pendapatan, Master Wisata, Produk, Kontak, Pelanggan & Vendor, Akun Float, Terminal POS & Laci Kas, Periode Fiskal, Bagan Akun).
- **Dry-run / pratinjau**: menjalankan langkah penghapusan di dalam transaksi lalu rollback, sehingga jumlah baris yang dilaporkan persis sama dengan eksekusi nyata tanpa menghapus data.
- **Penghapusan atomik** dengan urutan child→parent sesuai relasi FK `onDelete: Restrict`; bila subset tidak konsisten, transaksi rollback penuh (tidak ada data terhapus sebagian).
- **Auto-dependency**: memilih master data otomatis menarik grup transaksi terkait agar konsisten.
- Pengaman: konfirmasi ketik nama bisnis + centang persetujuan, dicatat di `GodModeAuditLog` (action `BUSINESS_DATA_RESET`).
- File baru: `src/presentation/admin/reset-data.ts`, `app/api/admin/reset/route.ts`, `app/(app)/admin/reset/{page,layout}.tsx`.
- Submenu navigasi Admin (God Mode): Panel Admin, Reset Data, Changelog.

### Fixed — Scan Laporan Harian (Transaction Timeout)
- `POST /api/sales/daily` (`prisma.dailySale.create`) gagal dengan "Transaction already closed: ... timeout 5000ms" pada DB Neon remote.
- Update loyalty kontak kini diagregasi per kontak unik (mengurangi round-trip di dalam transaksi), perilaku hitungan kunjungan/omzet tidak berubah.
- Timeout transaksi dilonggarkan (`maxWait 10s`, `timeout 20s`) di route tersebut.
- Default global `transactionOptions` (`maxWait 10s`, `timeout 20s`) ditambahkan di `prisma.ts` agar seluruh `$transaction` punya headroom untuk DB remote.

### Fixed — Tampilan Halaman Changelog
- Butir changelog tidak lagi dipotong satu baris (`truncate` dihapus) dan ukuran font dinaikkan agar terbaca; badge kode inline membungkus normal.

## [0.6.0] - 2026-06-05

### Added — Brand Identity & Layout Polishing
- **Favicons & Logo**: Generated 3D glassmorphic transparent icon assets (`favicon.ico`, `icon.png`, `apple-icon.png`, `public/logo.png`) and integrated the new logo into the sidebar layout.
- **Header Alignment**: Aligned sidebar logo header height to `h-16` to match the top header exactly.
- **Custom Scrollbar**: Implemented modern, thin (5px), rounded, and floating scrollbars globally in `globals.css` to replace default browser scrollbars.

### Added — Dashboard Date Filters & Real-time Trends
- **Range Filters**: Implemented rolling range selectors (1 Minggu, 1 Bulan, 3 Bulan, 6 Bulan, 1 Tahun) on the main dashboard page.
- **Dynamic Grouping Trend**: Connected charts to actual sales and cash flow trend data calculated from database records in `dashboard-engine.ts`, with auto-grouping by day, week, or month.

### Changed — Cashier RBAC Permissions
- **Scan Access**: Allowed Cashiers to use the daily scan reports tool by mapping `/api/reports/scan` (POST) to `sales:write`.
- **COA Read-only Access**: Configured GET requests on `/api/accounting/chart-of-accounts` to require `dashboard:read` (allowing Cashiers to list accounts in dropdowns) while keeping mutations (`POST, PUT, DELETE, PATCH`) under `coa:write`.
- **RBAC Tests**: Added assertions verifying Cashier's new scan and COA list permissions in `rbac-permissions.test.ts`.

## [0.5.0] - 2026-06-03


### Added — UI Compliance (Glass Design System)
- `GlassDataSelect` — dropdown data-driven baru, tanpa native `<select>`. Dipakai di semua 20+ page
- `GlassCheckbox` — wrapper checkbox untuk row selection di `glass-table.tsx`
- `GlassDatePicker`, `GlassDateTimePicker`, `GlassTimePicker` direfactor menjadi **controlled components** (`value`/`onChange` prop)
- Semua 26 file frontend dibersihkan dari native elements: `<select>`, `<input>`, `<input type="date">`, `<input type="datetime-local">`, `confirm()`
- `RhfDataSelect` diupdate menggunakan `GlassDataSelect`

### Added — Export PDF & Excel
- Installed: `jspdf`, `jspdf-autotable`, `xlsx`
- `src/presentation/export/report-exports.ts` — 8 fungsi export (4 laporan × 2 format)
- `ExportDropdown` component di `ReportWorkspace` — dropdown "📄 PDF / 📊 Excel (.xlsx)"
- 4 halaman laporan terhubung: Laba Rugi, Neraca, Buku Besar, Neraca Saldo
- Dynamic import — library hanya di-load saat tombol diklik (tidak membebani bundle)
- Nama file otomatis: `laba-rugi-2026-06.pdf`, `neraca-2026-06.xlsx`, dll

### Added — Onboarding Flow
- `app/(auth)/onboarding/page.tsx` — wizard 3 langkah setelah registrasi
  - Step 1 & 2 (akun + COA) otomatis selesai, Step 3 (buka fiscal period) oleh user
  - Pilihan tahun, tombol buka → redirect ke dashboard
- Register form: tambah field "Jenis usaha" (UMKM/Perorangan/BUMDes/CV/UD)
- Register API: terima `businessType`, redirect ke `/onboarding` bukan `/dashboard`

### Added — Session Revocation
- `DELETE /api/auth/sessions` — user logout dari semua perangkat lain (`?all=true` untuk termasuk sekarang)
- `DELETE /api/admin/users/[id]/sessions` — SUPER_ADMIN/SUPPORT_AGENT force logout user
- Settings page: section "Keamanan Sesi" dengan tombol "Keluar dari semua perangkat lain"
- Admin panel: kolom "Aksi" dengan tombol "Force logout" per user

### Added — Error Tracking (Sentry, opt-in)
- Installed: `@sentry/nextjs@10.56.0`
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `app/global-error.tsx` — Next.js global error boundary dengan `Sentry.captureException`
- `next.config.ts` — `withSentryConfig` wrapper kondisional (aktif hanya jika `SENTRY_DSN` di-set)
- `.env.example` — dokumentasi variabel Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, dll)

### Fixed — CI/CD & Connection Pooling
- `prisma/schema.prisma`: tambah `directUrl = env("DIRECT_URL")`
- `.env`: hapus `channel_binding=require`, tambah `pgbouncer=true&connection_limit=1`, tambah `DIRECT_URL`
- `ci.yml`: tambah `DIRECT_URL` di semua job, step `npm run lint`, `NEXT_PUBLIC_SENTRY_DSN: ""`
- `deploy.yml`: job `check` (typecheck) sebelum migrate, migrate pakai `DIRECT_URL`, `SENTRY_AUTH_TOKEN`

### Fixed — Bugs
- `GlassCalendar`: header hari duplikat `["Min","Sel","Rab","Kam","Jum","Sab","Min"]` → `["Min","Sen","Sel","Rab","Kam","Jum","Sab"]`

## [0.4.0] - 2026-06-03

### Added — Authentication System
- `better-auth` dengan Prisma adapter untuk email/password authentication
- Password hashing menggunakan **argon2id** via `argon2` package
- Cookie-based sessions (7-day expiry, 1-day sliding update)
- Prisma models baru: `User`, `Session`, `AuthAccount`, `VerificationToken`
- `PlatformRole` enum: `USER`, `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`, `DEVELOPER`

### Added — Authorization & RBAC
- `middleware.ts` — melindungi semua `/api/*` routes, memvalidasi session token, mengecek business membership
- `BusinessMember` + `BusinessMemberRole` (OWNER, ADMIN, ACCOUNTANT, EDITOR, CASHIER, VIEWER) di Prisma schema
- `ROUTE_PERMISSION_RULES` — mapping route pattern → permission yang diperlukan
- `getAuthenticatedUserContextByToken()` — builds full auth context dari session + BusinessMember; `businessId` dan `actorUserId` tidak lagi dipercaya dari client
- God Mode: `/api/admin/*` routes hanya bisa diakses `SUPER_ADMIN`, `SUPPORT_AGENT`, `DEVELOPER`

### Added — Rate Limiting
- `MemoryRateLimiter` untuk development
- `UpstashRedisRateLimiter` untuk production (auto-detect via env vars)
- Rules terpisah per endpoint type: auth login (5/min), register (3/min), API read (300/min), write (100/min), reports (30/min), POS checkout (60/min)

### Added — Security Headers
- Content-Security-Policy, X-Frame-Options (DENY), HSTS (1 year), X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Applied via `withSecurityHeaders()` pada semua API responses di middleware

### Added — Auth API Routes
- `POST /api/auth/register` — registrasi user baru
- `POST /api/auth/select-business` — pilih active business untuk session
- `GET  /api/auth/businesses` — list bisnis yang bisa diakses user
- `POST /api/auth/logout` — invalidate session
- `POST /api/auth/bootstrap` — seed SUPER_ADMIN pertama (hanya jika belum ada)
- `POST /api/auth/dev-login` — shortcut login untuk development (disabled di production)
- `GET/POST /api/admin/users` — God Mode: list dan manage platform users
- `PATCH /api/admin/users/[id]/platform-role` — assign platform role
- `GET /api/admin/businesses` — God Mode: list semua bisnis

## [0.3.0] - 2026-06-01

### Added — Revenue & Tourism API Routes
Wired the previously dormant Revenue and Tourism modules (full service + Prisma repository already existed but had no DI registration or HTTP surface) into `server-services.ts` and exposed them via API routes.

- `RevenueService` (+ `PrismaRevenueRepository`) and `TourismService` (+ `PrismaTourismRepository`) registered in DI; tourism reuses the revenue service for its draft/post/void journal flow.
- Revenue routes: `POST/GET /api/revenue/categories`, `/api/revenue/items`, `/api/revenue/packages`, `POST /api/revenue/pricing`, `POST/GET /api/revenue/transactions`, `POST /api/revenue/transactions/preview`, `/api/revenue/transactions/post`, `/api/revenue/transactions/void`.
- Tourism routes: `POST/GET /api/tourism/attractions`, `POST /api/tourism/ticket-types`, `/api/tourism/ticket-packages`, `/api/tourism/parking-services`, `/api/tourism/rental-services`, `/api/tourism/tenant-rentals`, `POST/GET /api/tourism/visitor-transactions`, `POST /api/tourism/visitor-transactions/void`, `POST /api/tourism/tickets/validate`.

### Added — RBAC & Validation
- New permissions `revenue:write` and `tourism:write`; granted to OWNER, ADMIN, CASHIER (revenue also to ACCOUNTANT). Route rules `/api/revenue` and `/api/tourism` added to `ROUTE_PERMISSION_RULES`.
- Zod request schemas for all revenue/tourism payloads in `request-schemas.ts` (bigint/date coercion, ≥10-char void reason).
- All revenue/tourism routes derive `businessId`/`actorUserId` from the session via `validatedBody`, never from the client.

## [0.2.0] - 2026-05-31

### Added — Persistence Layer
- **Purchase Module**: `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `PurchaseReturn` Prisma models + `PrismaPurchaseRepository` (13 methods)
- **Cash Session Module**: `CashDrawer`, `CashSessionRecord`, `CashMovementRecord`, `CashReconciliationRecord` Prisma models + `PrismaCashSessionRepository` (10 methods)
- **POS Module**: `PosTerminal`, `PosSessionRecord`, `PosTransactionRecord`, `PosCartItem`, `PosReceiptRecord` Prisma models + `PrismaPosRepository` (18 methods)
- **Float Module**: Wired `FloatManagementService` + `PrismaFloatRepository` into DI

### Added — API Routes
- `POST /api/inventory/products` — create product
- `POST /api/inventory/stock-in` — stock in with journal
- `POST /api/sales/orders/confirm` — confirm sales order
- `POST /api/sales/orders/payment` — allocate payment to sales
- `POST /api/ar-ap/invoices/post` — post invoice (DR AR, CR Revenue)
- `POST /api/ar-ap/bills/post` — post bill (DR Expense, CR AP)
- `POST /api/ar-ap/payments` — record AR/AP payment
- `POST /api/cash/transactions/post` — post cash transaction
- `POST /api/cash/transactions/void` — void with reversal journal
- `POST /api/cash/drawers` — create/list cash drawers
- `POST /api/pos/terminals` — create/list POS terminals
- `POST /api/pos/sessions/close` — close POS session
- `POST /api/pos/cart` — add/remove cart items
- `POST /api/pos/checkout` — checkout POS transaction
- `POST /api/pos/payment` — allocate POS payment
- `POST /api/pos/void` — void POS transaction

### Added — Infrastructure
- `.env` / `.env.example` for Neon PostgreSQL connection
- `.gitignore` for standard Next.js project
- Global `serializeResponse()` for BigInt/Date JSON serialization
- Atomic inventory SQL (`INSERT ON CONFLICT DO UPDATE` for stock-in/out)
- Advisory lock (`pg_advisory_xact_lock`) for journal number serialization
- Retry loop (10 attempts, exponential backoff) for journal posting

### Added — Prisma Enums
- `PurchaseOrderStatus` (DRAFT, APPROVED, RECEIVED, PARTIALLY_RECEIVED, COMPLETED, CANCELLED)
- `CashSessionStatus` (OPEN, CLOSED)
- `CashMovementType` (OPENING_BALANCE, SALE_RECEIPT, CUSTOMER_DEPOSIT, EXPENSE, WITHDRAWAL, TRANSFER, ADJUSTMENT, CLOSING)
- `PosSessionStatus` (OPEN, CLOSED)
- `PosTransactionStatus` (DRAFT, CHECKOUT, PARTIALLY_PAID, PAID, VOID)

### Added — Audit Actions
- `PURCHASE_ORDER_CREATED`, `PURCHASE_ORDER_APPROVED`, `PURCHASE_ORDER_RECEIVED`, `PURCHASE_RETURN_CREATED`, `PURCHASE_VENDOR_BILL_GENERATED`
- `CASH_SESSION_OPENED`, `CASH_SESSION_CLOSED`, `CASH_MOVEMENT_RECORDED`, `CASH_TRANSFER_RECORDED`, `CASH_RECONCILED`
- `POS_SESSION_OPENED`, `POS_SESSION_CLOSED`, `POS_CART_UPDATED`, `POS_TRANSACTION_CHECKED_OUT`, `POS_PAYMENT_ALLOCATED`, `POS_CHANGE_SAVED_TO_DEPOSIT`, `POS_TRANSACTION_VOIDED`
- `SALES_ORDER_CREATED`, `SALES_ORDER_CONFIRMED`, `SALES_PAYMENT_ALLOCATED`

### Fixed — Critical Bugs
- **SalesService DI**: Replaced `{} as any` with real `InventoryService` instance — was causing runtime crash on sales confirmation with physical/digital products
- **AR/AP numbering**: `PrismaArApRepository.next()` now queries latest number instead of always returning 00001 — was causing unique constraint violations
- **Date parsing**: Fixed 12 API routes that passed string dates to services expecting Date objects
- **BigInt serialization**: Added global `serializeResponse()` that recursively converts BigInt to string — was causing `Do not know how to serialize a BigInt` errors
- **Sales items**: Route now converts quantity/unitPrice/discountAmount/taxAmount to BigInt
- **Cash transactions**: Route now converts transactionDate to Date and amount to BigInt

### Fixed — Concurrency Bugs
- **Inventory lost updates**: Replaced read-compute-write pattern with atomic SQL (`INSERT ON CONFLICT DO UPDATE SET quantity = quantity + $delta`)
- **Journal number collisions**: Replaced `findFirst` + increment with `pg_advisory_xact_lock` + retry loop

### Changed — Dashboard
- All 7 dashboard pages now fetch real data from PostgreSQL instead of hardcoded demo values
- `/api/dashboard/overview` now runs 17 Prisma queries server-side + generates P&L via ReportingService

### Changed — Reporting
- All 9 report routes now call `serverServices.reporting.*` or query Prisma directly instead of using hardcoded inline data

### Removed
- `src/presentation/modules/sample-data.ts` (dead code)
- `src/presentation/modules/transaction-sample-data.ts` (dead code)
- All hardcoded arrays from 22+ API route files
- All stub/mock responses from production code paths

---

## [0.1.0] - Pre-session state

### Existing (before this session)
- Domain engines for all 15 modules
- Application services for all 15 modules
- Prisma infrastructure for: Accounting, Business, Chart of Accounts, Cash Management, Revenue, Tourism, AR/AP, Float, Inventory, Sales, Payment, Reporting
- Unit tests: 149 tests across 20 files
- Next.js App Router with glassmorphism UI
- React Query + React Hook Form frontend
