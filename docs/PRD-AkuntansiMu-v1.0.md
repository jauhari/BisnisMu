# Product Requirements Document (PRD)
## AkuntansiMu — Aplikasi Akuntansi untuk UMKM & Badan Usaha Desa

**Versi:** 1.0  
**Tanggal:** 30 Mei 2026  
**Status:** Draft  
**Author:** [Nama Anda]  
**Standar Acuan:** SAK EMKM (Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah) — IAI 2016/rev.2021

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Latar Belakang & Masalah](#2-latar-belakang--masalah)
3. [Target Pengguna](#3-target-pengguna)
4. [Tujuan Produk & Success Metrics](#4-tujuan-produk--success-metrics)
5. [Scope & Out of Scope](#5-scope--out-of-scope)
6. [Stack Teknologi](#6-stack-teknologi)
7. [Arsitektur Sistem](#7-arsitektur-sistem)
8. [Struktur Data & Chart of Accounts](#8-struktur-data--chart-of-accounts)
9. [Fitur & Modul Detail](#9-fitur--modul-detail)
10. [Multi-Usaha (Multi-Tenant)](#10-multi-usaha-multi-tenant)
11. [UX & Design Principles](#11-ux--design-principles)
12. [Keamanan](#12-keamanan)
13. [Alur Akuntansi & Validasi](#13-alur-akuntansi--validasi)
14. [Laporan Keuangan (SAK EMKM)](#14-laporan-keuangan-sak-emkm)
15. [Integrasi](#15-integrasi)
16. [Roadmap & Prioritas](#16-roadmap--prioritas)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Risiko & Mitigasi](#18-risiko--mitigasi)
19. [Glossary](#19-glossary)

---

## 1. Executive Summary

**AkuntansiMu** adalah aplikasi akuntansi berbasis web yang dirancang khusus untuk:
- UMKM (Usaha Mikro, Kecil, Menengah)
- Usaha rumahan / skala kecil
- Badan Usaha Desa (BUMDes) / Badan Usaha Daerah

Aplikasi ini mengikuti **SAK EMKM** (standar akuntansi resmi Indonesia untuk entitas kecil), mudah digunakan tanpa latar belakang akuntansi formal, mendukung **multi-usaha dalam satu akun**, dan dibangun di atas stack modern yang aman, cepat, dan dapat di-deploy di lingkungan Windows maupun Linux.

**Diferensiasi utama:**
- Jurnal otomatis yang benar secara akuntansi (bukan hanya input transaksi sederhana)
- Panduan kontekstual untuk pengguna awam akuntansi
- Dukungan BUMDes dengan format laporan sesuai Permendesa No. 4 Tahun 2015
- Offline-capable (PWA) untuk daerah dengan koneksi terbatas

---

## 2. Latar Belakang & Masalah

### 2.1 Konteks

Indonesia memiliki 64+ juta UMKM yang menyumbang ~61% PDB. Namun, mayoritas tidak memiliki pembukuan yang benar karena:
- Software akuntansi yang ada (Accurate, MYOB, SAP) terlalu kompleks dan mahal
- Aplikasi sederhana yang ada tidak memenuhi standar akuntansi Indonesia
- Keterbatasan literasi akuntansi pelaku UMKM
- Banyak yang masih menggunakan Excel atau buku tulis

### 2.2 Pain Points Spesifik

| Segmen | Masalah Utama |
|--------|--------------|
| Usaha Rumahan | Tidak ada pemisahan keuangan usaha vs pribadi |
| UMKM Dagang | Tidak bisa tracking stok & HPP (Harga Pokok Penjualan) |
| UMKM Jasa | Tidak bisa kelola piutang & invoice dengan baik |
| BUMDes | Perlu format laporan khusus sesuai regulasi Permendesa |
| Semua | Tidak siap audit bank / pengajuan KUR |

### 2.3 Masalah yang Ditemukan pada Kompetitor Lokal

Berdasarkan analisis produk yang ada:
- Inkonsistensi tipe transaksi vs akun (Kas Masuk tapi akun Beban — ini salah akuntansi)
- Klasifikasi akun yang salah (Kas dikategorikan Aset Tetap)
- Tidak ada validasi normal balance per jenis akun
- Laporan tidak sesuai format SAK EMKM

---

## 3. Target Pengguna

### 3.1 Primary Users

**Persona 1 — Ibu Sari (Usaha Rumahan)**
- Usia: 35–50 tahun
- Usaha: Warung makan, catering, atau toko kelontong
- Literasi teknologi: Bisa WhatsApp dan marketplace
- Kebutuhan: Catat pemasukan/pengeluaran harian, tahu untung/rugi
- Pain: Tidak paham jurnal, debit-kredit terasa asing

**Persona 2 — Pak Budi (UMKM Dagang)**
- Usia: 30–45 tahun
- Usaha: Toko bangunan, distributor, grosir
- Kebutuhan: Invoice, stok barang, laporan untuk bank/KUR
- Pain: Excel berantakan, tidak bisa tracking stok vs penjualan

**Persona 3 — Bendahara BUMDes**
- Usia: 25–45 tahun
- Usaha: Badan Usaha Milik Desa (simpan pinjam, jual beli, jasa)
- Kebutuhan: Laporan sesuai Permendesa, akuntabilitas ke kepala desa
- Pain: Tidak ada software yang mendukung format BUMDes

**Persona 4 — Akuntan/Admin UMKM**
- Usia: 22–35 tahun
- Literasi teknologi: Tinggi
- Kebutuhan: Multi-usaha, export laporan, jurnal manual jika diperlukan
- Pain: Software yang ada terlalu mahal atau tidak fleksibel

### 3.2 Secondary Users

- Konsultan / pendamping UMKM
- Dinas Koperasi & UMKM yang butuh monitoring
- Bank / lembaga keuangan yang butuh laporan dari nasabah KUR

---

## 4. Tujuan Produk & Success Metrics

### 4.1 Tujuan

1. Memungkinkan UMKM membuat laporan keuangan yang benar secara SAK EMKM
2. Mengurangi waktu pembukuan dari jam ke menit per hari
3. Meningkatkan akses UMKM ke pembiayaan (KUR, investor)
4. Mendukung akuntabilitas BUMDes sesuai regulasi

### 4.2 Success Metrics (OKRs)

| Metrik | Target 6 Bulan | Target 12 Bulan |
|--------|---------------|----------------|
| Pengguna aktif bulanan (MAU) | 1.000 | 10.000 |
| Usaha yang terdaftar | 1.500 | 15.000 |
| Transaksi diinput per bulan | 50.000 | 500.000 |
| Laporan keuangan dihasilkan | 3.000 | 30.000 |
| Churn rate bulanan | < 10% | < 7% |
| NPS Score | > 40 | > 55 |
| Waktu onboarding (first transaction) | < 10 menit | < 5 menit |

---

## 5. Scope & Out of Scope

### 5.1 In Scope (MVP — Phase 1)

- Manajemen akun pengguna & multi-usaha
- Chart of Accounts standar SAK EMKM
- Transaksi: Kas Masuk, Kas Keluar, Transfer antar kas
- Jurnal otomatis dengan validasi normal balance
- Buku Besar & Trial Balance
- Laporan Laba Rugi (SAK EMKM)
- Laporan Posisi Keuangan / Neraca (SAK EMKM)
- Manajemen Kontak (pelanggan & pemasok)
- Manajemen Aset Tetap dasar
- Export PDF & Excel
- Multi-usaha (max 3 usaha per akun gratis)

### 5.2 In Scope (Phase 2)

- Invoice & faktur penjualan
- Bill / tagihan pembelian
- Manajemen Piutang & Utang lengkap
- Manajemen Inventori / Stok
- Pajak: PPN & PPh 21/23 dasar
- Rekonsiliasi Bank
- Dashboard analitik
- Laporan Arus Kas
- Format Laporan BUMDes (Permendesa)
- Notifikasi jatuh tempo

### 5.3 Phase 3 (Future)

- Payroll / penggajian
- Integrasi e-Faktur DJP
- Integrasi marketplace (Tokopedia, Shopee)
- Integrasi perbankan (bank statement import)
- Mobile App native (Android/iOS)
- AI assistant akuntansi
- Multi-currency

### 5.4 Out of Scope (Tidak Dikerjakan)

- Akuntansi perusahaan publik / Tbk (menggunakan PSAK penuh)
- Payroll kompleks (BPJS otomatis, PPh 21 lanjutan) — Phase 3
- Point of Sale (POS) — produk terpisah jika diperlukan
- Integrasi ERP (SAP, Oracle) — bukan target segmen

---

## 6. Stack Teknologi

### 6.1 Rekomendasi Stack (Windows-Friendly, No PHP)

#### Frontend
```
Framework    : Next.js 14+ (App Router)
Language     : TypeScript
Styling      : Tailwind CSS + shadcn/ui
State Mgmt   : Zustand (ringan) + React Query (server state)
Form         : React Hook Form + Zod (validasi schema)
Tabel        : TanStack Table v8
Chart        : Recharts atau Chart.js
PDF Export   : React-PDF / jsPDF
Excel Export : SheetJS (xlsx)
PWA          : next-pwa
```

**Alasan Next.js:** Full-stack dalam satu project, file-based routing, Server Components untuk performa, mudah di-deploy di Vercel/Railway/VPS, berjalan sempurna di Windows.

#### Backend (API)
```
Runtime      : Node.js 20 LTS
Framework    : Next.js API Routes atau Hono.js (jika pisah)
ORM          : Prisma (type-safe, auto-migration, Windows-friendly)
Validasi     : Zod (shared dengan frontend)
Auth         : NextAuth.js v5 / Lucia Auth
Queue        : BullMQ (untuk job berat seperti generate laporan)
```

#### Database
```
Primary DB   : PostgreSQL 16
  - Alasan: ACID compliance (kritis untuk akuntansi), JSON support,
    full-text search, gratis, performa tinggi
  - Windows: gunakan Docker Desktop atau Laragon (PostgreSQL)

Cache        : Redis (via Upstash untuk serverless, atau lokal)
  - Session, rate limiting, job queue

File Storage : MinIO (self-hosted, S3-compatible) atau Cloudflare R2
  - Untuk attachment bukti transaksi, laporan PDF
```

#### DevOps & Deployment
```
Containerize : Docker + Docker Compose (Windows Docker Desktop)
CI/CD        : GitHub Actions
Deploy       : Railway.app (recommended, mudah) atau Coolify (self-host)
Monitoring   : Sentry (error tracking) + Posthog (analytics)
Environment  : .env dengan Doppler atau dotenv-vault
```

#### Development Tools
```
Package Mgr  : pnpm (lebih cepat dari npm, Windows-friendly)
Linting      : ESLint + Prettier
Testing      : Vitest (unit) + Playwright (E2E)
API Docs     : OpenAPI/Swagger via Zod-to-OpenAPI
Git Strategy : GitHub Flow (main + feature branches)
```

### 6.2 Kenapa Bukan PHP?

PHP memerlukan setup XAMPP/Laragon yang terkadang conflict dengan port Windows, ekstensi PHP yang tidak konsisten antar OS, dan developer experience yang lebih lambat. Stack Node.js/Next.js berjalan native di Windows dengan `pnpm install && pnpm dev` — tidak perlu konfigurasi server tambahan.

### 6.3 Alternatif Jika Butuh Backend Terpisah

Jika tim memutuskan API terpisah dari frontend:
```
Option A: Hono.js + Bun runtime (tercepat, TypeScript native)
Option B: Fastify + Node.js (battle-tested, ecosystem luas)
Option C: NestJS (jika tim butuh struktur enterprise-style)
```

---

## 7. Arsitektur Sistem

### 7.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│  Next.js (React) — Browser / PWA (offline support)  │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS / REST + WebSocket
┌─────────────────▼───────────────────────────────────┐
│                   APPLICATION LAYER                  │
│  Next.js API Routes / Hono.js                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │Auth/RBAC │ │Accounting│ │  Report Generator    │ │
│  │ Service  │ │  Engine  │ │  (Async via Queue)   │ │
│  └──────────┘ └──────────┘ └──────────────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                    DATA LAYER                        │
│  PostgreSQL (primary) │ Redis (cache/queue)         │
│  MinIO / R2 (files)                                 │
└─────────────────────────────────────────────────────┘
```

### 7.2 Multi-Tenant Architecture

AkuntansiMu menggunakan **Row-Level Multi-Tenancy** dengan kolom `business_id` pada setiap tabel. Setiap user dapat memiliki dan beralih antar beberapa usaha (business entities).

```
User (1) ──── UserBusinessMember (many) ──── Business (many)
                    │
                    └── Role: OWNER | ADMIN | EDITOR | VIEWER
```

Isolasi data dijamin via:
1. Prisma middleware yang auto-inject `WHERE business_id = ?` pada setiap query
2. RLS (Row Level Security) di PostgreSQL sebagai defense-in-depth
3. JWT claim yang menyertakan `businessId` aktif

### 7.3 Accounting Engine

Engine akuntansi adalah komponen paling kritis. Dipisahkan sebagai pure TypeScript module yang bisa ditest secara independen.

**Tanggung jawab:**
- Validasi normal balance setiap akun (Aset=Debit, Liabilitas=Kredit, dsb.)
- Generate jurnal double-entry otomatis dari transaksi
- Validasi keseimbangan jurnal (total Debit = total Kredit)
- Kalkulasi saldo berjalan (running balance)
- Deteksi inkonsistensi data

---

## 8. Struktur Data & Chart of Accounts

### 8.1 Chart of Accounts Standar SAK EMKM

Sistem menggunakan kode akun 6 digit dengan hierarki:

```
1-XXXXX  ASET
  1-1XXXX  Aset Lancar
    110101   Kas (Tunai)
    110102   Kas di Bank [nama bank]
    110201   Piutang Usaha
    110301   Persediaan Barang Dagang
    110401   Biaya Dibayar di Muka
  1-2XXXX  Aset Tidak Lancar
    120101   Tanah
    120201   Bangunan
    120202   Akumulasi Penyusutan Bangunan (Kontra)
    120301   Peralatan
    120302   Akumulasi Penyusutan Peralatan (Kontra)
    120401   Kendaraan
    120402   Akumulasi Penyusutan Kendaraan (Kontra)

2-XXXXX  LIABILITAS
  2-1XXXX  Liabilitas Jangka Pendek
    210101   Utang Usaha
    210201   Utang Bank Jangka Pendek
    210301   Utang Pajak (PPN/PPh)
    210401   Beban Akrual
  2-2XXXX  Liabilitas Jangka Panjang
    220101   Utang Bank Jangka Panjang

3-XXXXX  EKUITAS
    310101   Modal Pemilik / Modal Awal
    310201   Prive (Pengambilan Pribadi)
    310301   Saldo Laba / Retained Earnings

4-XXXXX  PENDAPATAN
    410101   Pendapatan Usaha / Penjualan
    410201   Pendapatan Jasa
    410301   Pendapatan Lain-lain

5-XXXXX  HARGA POKOK
    510101   Harga Pokok Penjualan (HPP)
    510201   Pembelian Barang Dagang

6-XXXXX  BEBAN OPERASIONAL
    610101   Beban Gaji & Upah
    610201   Beban Sewa
    610301   Beban Listrik, Air, Telepon
    610401   Beban Transportasi
    610501   Beban Perlengkapan & ATK
    610601   Beban Pemasaran / Iklan
    610701   Beban Penyusutan Aset
    610801   Beban Lain-lain Operasional

7-XXXXX  BEBAN LAIN-LAIN
    710101   Beban Bunga
    710201   Beban Pajak
```

**Aturan Normal Balance (WAJIB divalidasi sistem):**

| Kelompok Akun | Normal Balance | Bertambah | Berkurang |
|--------------|---------------|-----------|-----------|
| Aset (1) | Debit | Debit | Kredit |
| Liabilitas (2) | Kredit | Kredit | Debit |
| Ekuitas (3) | Kredit | Kredit | Debit |
| Pendapatan (4) | Kredit | Kredit | Debit |
| HPP (5) | Debit | Debit | Kredit |
| Beban (6, 7) | Debit | Debit | Kredit |

### 8.2 Skema Database Inti (Prisma Schema)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  memberships   BusinessMember[]
  sessions      Session[]
}

model Business {
  id           String   @id @default(cuid())
  name         String
  type         BusinessType  // UMKM | BUMDES | PERORANGAN | CV | UD
  npwpNumber   String?
  address      String?
  fiscalYearStart Int   @default(1)  // Bulan (1=Januari)
  currency     String   @default("IDR")
  createdAt    DateTime @default(now())
  
  members      BusinessMember[]
  accounts     Account[]
  transactions Transaction[]
  journalEntries JournalEntry[]
  contacts     Contact[]
  assets       FixedAsset[]
}

model BusinessMember {
  userId     String
  businessId String
  role       Role     // OWNER | ADMIN | EDITOR | VIEWER
  user       User     @relation(fields: [userId], references: [id])
  business   Business @relation(fields: [businessId], references: [id])
  @@id([userId, businessId])
}

model Account {
  id           String      @id @default(cuid())
  businessId   String
  code         String      // e.g. "110101"
  name         String      // e.g. "Kas Tunai"
  type         AccountType // ASSET | LIABILITY | EQUITY | REVENUE | COGS | EXPENSE
  subtype      String?     // current_asset | fixed_asset | etc.
  normalBalance BalanceSide // DEBIT | CREDIT
  isSystem     Boolean     @default(false)  // Akun bawaan sistem, tidak bisa dihapus
  parentCode   String?
  isActive     Boolean     @default(true)
  business     Business    @relation(fields: [businessId], references: [id])
  journalLines JournalLine[]
  @@unique([businessId, code])
}

model Transaction {
  id             String          @id @default(cuid())
  businessId     String
  txNumber       String          // TX-XXXXXXXX (auto-generate)
  type           TransactionType // KAS_MASUK | KAS_KELUAR | TRANSFER | INVOICE | BILL | JOURNAL
  date           DateTime
  description    String
  amount         Decimal         @db.Decimal(15, 2)
  paymentMethod  PaymentMethod   // TUNAI | TRANSFER_BANK | KARTU | dll
  referenceNo    String?
  status         TxStatus        // DRAFT | POSTED | VOID
  contactId      String?
  createdById    String
  createdAt      DateTime        @default(now())
  
  business       Business        @relation(fields: [businessId], references: [id])
  journalEntries JournalEntry[]
  attachments    Attachment[]
}

model JournalEntry {
  id            String        @id @default(cuid())
  businessId    String
  transactionId String?
  entryNumber   String        // JE-XXXXXXXX
  date          DateTime
  description   String
  isBalanced    Boolean       @default(false)  // total debit == total kredit
  isPosted      Boolean       @default(false)
  createdById   String
  createdAt     DateTime      @default(now())
  
  lines         JournalLine[]
  transaction   Transaction?  @relation(fields: [transactionId], references: [id])
}

model JournalLine {
  id             String       @id @default(cuid())
  journalEntryId String
  accountId      String
  debit          Decimal      @db.Decimal(15, 2) @default(0)
  credit         Decimal      @db.Decimal(15, 2) @default(0)
  description    String?
  
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id])
  account        Account      @relation(fields: [accountId], references: [id])
}
```

---

## 9. Fitur & Modul Detail

### 9.1 Onboarding & Setup Usaha

**Wizard Setup (max 5 langkah):**
1. Nama & tipe usaha (UMKM / BUMDes / Perorangan)
2. Pilih template Chart of Accounts (Dagang / Jasa / Campuran / BUMDes)
3. Set periode fiskal (default: Januari–Desember)
4. Input saldo awal akun (opsional, bisa skip)
5. Done → masuk Dashboard

**Validasi:**
- Nama usaha wajib diisi
- Tipe usaha menentukan template CoA yang digunakan
- Saldo awal harus balance (total aset = liabilitas + ekuitas) sebelum bisa diposting

### 9.2 Daftar Akun (Chart of Accounts)

**Fitur:**
- Tampil hierarki (group → sub-group → akun)
- Filter per tipe akun
- Tambah akun kustom (dalam range kode yang diizinkan)
- Edit nama & deskripsi akun (kode sistem tidak bisa diubah)
- Non-aktifkan akun yang tidak dipakai
- Tampil saldo berjalan per akun

**Validasi:**
- Kode akun harus unik per usaha
- Akun dengan transaksi tidak bisa dihapus (hanya non-aktif)
- Sistem mencegah pembuatan akun dengan kode yang bertentangan dengan kelompok (misal: tidak bisa buat akun aset dengan kode 6-xxxxx)

### 9.3 Transaksi

#### 9.3.1 Tipe Transaksi & Jurnal Otomatis

**Kas Masuk (Pendapatan Usaha):**
```
Debit : Kas / Bank              [+]
Kredit: Pendapatan Usaha        [+]
```

**Kas Masuk (Penerimaan Piutang):**
```
Debit : Kas / Bank              [+]
Kredit: Piutang Usaha           [-]
```

**Kas Keluar (Beban Operasional — contoh: bayar gaji):**
```
Debit : Beban Gaji              [+]
Kredit: Kas / Bank              [-]
```

**Kas Keluar (Bayar Utang):**
```
Debit : Utang Usaha             [-]
Kredit: Kas / Bank              [-]
```

**Transfer antar Kas/Bank:**
```
Debit : Kas/Bank Tujuan         [+]
Kredit: Kas/Bank Asal           [-]
```

**CRITICAL — Validasi Wajib:**
- Sistem harus mendeteksi dan memperingatkan jika kategori akun tidak sesuai tipe transaksi
- Contoh: jika user pilih "Kas Masuk" tapi kategori akun adalah Beban → tampilkan warning: *"Akun Beban biasanya digunakan untuk Kas Keluar. Apakah ini pengeluaran?"*
- Jurnal TIDAK bisa diposting jika total Debit ≠ total Kredit

#### 9.3.2 Form Input Transaksi

**Field wajib:**
- Tipe transaksi (Kas Masuk / Kas Keluar / Transfer)
- Tanggal
- Akun Kas/Bank yang terlibat
- Kategori / Akun lawan
- Jumlah
- Deskripsi

**Field opsional:**
- Kontak (pelanggan / pemasok)
- Metode pembayaran
- Nomor referensi / nota
- Foto bukti (attachment)
- Tag / label kustom

**UX Guidelines Form:**
- Default tanggal = hari ini
- Autocomplete pada kolom akun & kontak
- Preview jurnal yang akan dibuat (real-time, sebelum simpan)
- Tombol "Simpan & Buat Lagi" untuk input cepat berulang

#### 9.3.3 Daftar Transaksi

- Tabel dengan kolom: Tanggal, No. Transaksi, Tipe, Akun, Deskripsi, Jumlah, Status
- Filter: Periode, Tipe, Akun, Kontak, Status
- Date range picker selalu visible (bukan di dalam dropdown)
- Summary bar di atas tabel: Total Masuk | Total Keluar | Selisih (Net)
- Sortable per kolom
- Pagination dengan info "Menampilkan X–Y dari Z transaksi"
- Bulk actions: Void, Export

### 9.4 Jurnal Umum

Untuk pengguna yang memahami akuntansi dan butuh input jurnal manual:

**Form Jurnal Manual:**
- Tanggal & deskripsi jurnal
- Tabel baris: Akun | Debit | Kredit | Keterangan
- Tombol "+ Tambah Baris"
- Real-time counter: Total Debit | Total Kredit | Selisih
- Tombol "Simpan" hanya aktif jika Debit = Kredit
- Warning jika normal balance dilanggar

**Validasi Jurnal:**
```typescript
function validateJournalEntry(lines: JournalLine[]): ValidationResult {
  // 1. Minimal 2 baris
  if (lines.length < 2) return error("Jurnal minimal memiliki 2 baris")
  
  // 2. Total debit = total kredit
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) 
    return error("Total Debit harus sama dengan total Kredit")
  
  // 3. Setiap baris hanya boleh isi debit ATAU kredit, tidak keduanya
  const invalidLines = lines.filter(l => l.debit > 0 && l.credit > 0)
  if (invalidLines.length > 0) 
    return error("Satu baris tidak boleh memiliki nilai Debit dan Kredit sekaligus")
  
  // 4. Validasi normal balance (peringatan, bukan error)
  lines.forEach(line => {
    const account = getAccount(line.accountId)
    if (account.normalBalance === 'DEBIT' && line.credit > 0) 
      return warning(`Akun ${account.name} biasanya di-Debit. Pastikan ini benar.`)
  })
  
  return success()
}
```

### 9.5 Buku Besar (General Ledger)

- Pilih akun & periode
- Tampil: Tanggal | Keterangan | Ref | Debit | Kredit | Saldo
- Saldo berjalan (running balance) dihitung otomatis
- Export per akun ke PDF/Excel

### 9.6 Laporan

Lihat Bagian 14 untuk detail format SAK EMKM.

**Laporan yang tersedia:**
- Neraca Saldo (Trial Balance)
- Laporan Laba Rugi
- Laporan Posisi Keuangan (Neraca)
- Laporan Arus Kas (Phase 2)
- Buku Besar per akun
- Mutasi Kas & Bank
- Laporan BUMDes (Phase 2, sesuai Permendesa)

### 9.7 Piutang & Utang (Phase 2)

**Piutang (Accounts Receivable):**
- Buat Invoice dengan nomor otomatis (INV-YYYY-XXXX)
- Status: Draft → Dikirim → Sebagian Bayar → Lunas → Void
- Pengingat jatuh tempo (notifikasi in-app & email)
- Rekap piutang per kontak & umur piutang (aging)

**Utang (Accounts Payable):**
- Input Bill dari pemasok
- Status: Draft → Disetujui → Sebagian Bayar → Lunas
- Kalender jatuh tempo pembayaran
- Rekap utang per pemasok

### 9.8 Aset Tetap

- Daftar aset: Nama, Kategori, Tanggal Perolehan, Nilai Perolehan, Metode Penyusutan
- Metode penyusutan: Garis Lurus (Straight-Line) dan Saldo Menurun
- Kalkulasi penyusutan otomatis bulanan/tahunan
- Jurnal penyusutan otomatis
- Laporan Daftar Aset

### 9.9 Kontak

- Tipe: Pelanggan | Pemasok | Keduanya
- Data: Nama, telepon, email, alamat, NPWP
- Riwayat transaksi per kontak
- Saldo piutang/utang per kontak

### 9.10 Pajak (Phase 2)

- Setup tarif PPN (11% default)
- Akun pajak masukan & keluaran
- Laporan rekap PPN per periode
- PPh 21/23 dasar (perhitungan manual, bukan e-SPT)

---

## 10. Multi-Usaha (Multi-Tenant)

### 10.1 Konsep

Satu akun pengguna dapat memiliki atau menjadi anggota dari beberapa usaha. Setiap usaha memiliki data yang sepenuhnya terisolasi.

### 10.2 Roles & Permission

| Permission | Owner | Admin | Editor | Viewer |
|-----------|-------|-------|--------|--------|
| Lihat semua data | ✅ | ✅ | ✅ | ✅ |
| Input transaksi | ✅ | ✅ | ✅ | ❌ |
| Approve transaksi | ✅ | ✅ | ❌ | ❌ |
| Kelola akun (CoA) | ✅ | ✅ | ❌ | ❌ |
| Generate laporan | ✅ | ✅ | ✅ | ✅ |
| Undang anggota | ✅ | ✅ | ❌ | ❌ |
| Hapus usaha | ✅ | ❌ | ❌ | ❌ |
| Billing & langganan | ✅ | ❌ | ❌ | ❌ |

### 10.3 Business Switcher

- Selector usaha di sidebar kiri atas (seperti yang sudah ada di AkuntansiMu)
- Tunjukkan nama usaha aktif + badge role pengguna
- Dropdown untuk beralih usaha atau tambah usaha baru
- Context switching menjaga route yang sama jika memungkinkan

### 10.4 Batasan Per Plan

| Plan | Usaha | User per Usaha | Transaksi/Bln | Storage |
|------|-------|---------------|--------------|---------|
| Gratis | 1 | 2 | 100 | 100 MB |
| Starter (Rp 49rb/bln) | 3 | 5 | 1.000 | 1 GB |
| Pro (Rp 149rb/bln) | 10 | 15 | Unlimited | 10 GB |
| BUMDes (Rp 99rb/bln) | 5 | 10 | Unlimited | 5 GB |

---

## 11. UX & Design Principles

### 11.1 Prinsip Desain

1. **Progressive Disclosure** — Tampilkan hanya yang dibutuhkan. Detail tersembunyi di balik expand/accordion.
2. **Plain Language** — Hindari jargon akuntansi. Gunakan bahasa sehari-hari + tooltip penjelasan.
3. **Error Prevention over Error Recovery** — Validasi real-time, bukan setelah submit.
4. **Contextual Help** — Ikon `?` di setiap field penting dengan penjelasan singkat.
5. **Mobile-First Responsive** — Banyak pengguna UMKM mengakses dari HP.
6. **Offline-Capable** — PWA dengan Service Worker untuk area sinyal lemah.

### 11.2 Navigasi Utama (Rekomendasi Final)

```
Sidebar Navigasi:
├── Dashboard
├── Daftar Akun
├── Penjualan          ← (bukan "Transaksi" generik)
│   ├── Invoice
│   └── Pelanggan
├── Pembelian
│   ├── Bill
│   └── Pemasok
├── Kas & Bank         ← Termasuk Kas Masuk/Keluar/Transfer & Rekonsiliasi
├── Jurnal Umum
├── Buku Besar
├── Laporan
│   ├── Laba Rugi
│   ├── Neraca
│   ├── Arus Kas
│   └── Neraca Saldo
├── Pajak
├── Aset Tetap
├── Kontak
├── Tim
└── Pengaturan         ← Changelog masuk di sini, bukan di nav utama
```

### 11.3 Panduan Input untuk Pengguna Awam

Untuk Persona 1 (Ibu Sari) yang tidak paham akuntansi:

- Mode "Sederhana": Input hanya Masuk/Keluar/Transfer dengan kategori pilihan
- Mode "Lengkap": Akses penuh Chart of Accounts (untuk Persona 4)
- Toggle antara kedua mode di Pengaturan
- Tooltip otomatis: saat pilih kategori "Beban Gaji", sistem otomatis menjelaskan "Ini akan dicatat sebagai pengeluaran usaha Anda"

### 11.4 Komponen UI Kritis

**Preview Jurnal (wajib ada sebelum simpan transaksi):**
```
┌────────────────────────────────────────────┐
│ 📋 Jurnal yang akan dibuat:                │
│                                            │
│ Akun                    Debit     Kredit   │
│ 610101 - Beban Gaji  18.990.000    -       │
│ 110101 - Kas Tunai       -     18.990.000  │
│                      ──────────  ──────────│
│ Total               18.990.000 18.990.000  │
│                                   ✅ Seimbang│
└────────────────────────────────────────────┘
```

**Summary Bar di atas daftar transaksi:**
```
┌──────────────┬──────────────┬──────────────┐
│ Total Masuk  │ Total Keluar │    Selisih   │
│ Rp 25.500.000│ Rp 18.200.000│ Rp 7.300.000 │
└──────────────┴──────────────┴──────────────┘
```

---

## 12. Keamanan

### 12.1 Authentication & Authorization

- Password hashing: **bcrypt** (cost factor 12) atau **Argon2id**
- Session: JWT dengan expiry 7 hari + refresh token rotation
- 2FA: TOTP (Google Authenticator) — wajib untuk role Owner
- Email verification wajib sebelum bisa input transaksi
- Rate limiting: 5 percobaan login gagal → lockout 15 menit

### 12.2 Data Security

- Semua komunikasi via **HTTPS/TLS 1.3**
- Database enkripsi at-rest (PostgreSQL dengan pgcrypto untuk field sensitif)
- Multi-tenant isolation: Row-Level Security (RLS) di PostgreSQL
- Input sanitization via Zod schema di setiap API endpoint
- SQL injection prevention via Prisma ORM (parameterized queries)
- XSS prevention via React (auto-escape) + Content Security Policy header

### 12.3 Audit Trail

Setiap perubahan data keuangan dicatat:
```
- Siapa yang membuat/mengubah/menghapus
- Kapan (timestamp dengan timezone)
- Data sebelum dan sesudah perubahan (JSON diff)
- IP address & User Agent
```

Transaksi yang sudah diposting **tidak bisa dihapus**, hanya bisa **di-void** (dengan jurnal pembalik otomatis) — sesuai prinsip akuntansi.

### 12.4 Backup & Recovery

- Backup database otomatis: harian ke object storage
- Retensi backup: 30 hari
- Point-in-time recovery (PITR) via PostgreSQL WAL
- RTO (Recovery Time Objective): < 4 jam
- RPO (Recovery Point Objective): < 1 jam

---

## 13. Alur Akuntansi & Validasi

### 13.1 Siklus Akuntansi yang Diimplementasi

```
Input Transaksi
      ↓
Validasi (tipe vs akun, jumlah > 0, tanggal valid)
      ↓
Generate Jurnal Otomatis
      ↓
Validasi Jurnal (Debit = Kredit, normal balance check)
      ↓
Preview kepada User
      ↓
User Konfirmasi → POST ke database (atomic transaction)
      ↓
Update Saldo Akun (running balance)
      ↓
Tersedia di Buku Besar & Laporan
```

### 13.2 Aturan Bisnis Kritis

1. **Immutability** — Transaksi yang sudah Posted tidak bisa diedit. Harus di-Void terlebih dahulu, lalu buat transaksi baru.
2. **Void dengan Jurnal Pembalik** — Void otomatis membuat jurnal kebalikan (reversing entry) di tanggal yang sama.
3. **Periode Tutup Buku** — Setelah periode ditutup (close), tidak ada transaksi baru yang bisa dibuat di periode tersebut.
4. **Konsistensi Mata Uang** — Semua transaksi dalam IDR. Konversi multi-currency di Phase 3.
5. **Saldo Negatif** — Sistem memperingatkan (tidak memblokir) jika transaksi menyebabkan saldo kas negatif.

---

## 14. Laporan Keuangan (SAK EMKM)

### 14.1 Laporan Laba Rugi

Sesuai SAK EMKM Bab 4:

```
LAPORAN LABA RUGI
[Nama Usaha]
Periode: [Tanggal Awal] s/d [Tanggal Akhir]

PENDAPATAN
  Pendapatan Usaha / Penjualan          Rp xxx.xxx.xxx
  Pendapatan Lain-lain                  Rp     xxx.xxx
  Total Pendapatan                                        Rp xxx.xxx.xxx

BEBAN
  Harga Pokok Penjualan (HPP)           Rp xxx.xxx.xxx
  Beban Gaji & Upah                     Rp  xx.xxx.xxx
  Beban Sewa                            Rp   x.xxx.xxx
  Beban Utilitas                        Rp   x.xxx.xxx
  Beban Penyusutan                      Rp     xxx.xxx
  Beban Lain-lain                       Rp     xxx.xxx
  Total Beban                                            (Rp xxx.xxx.xxx)

LABA (RUGI) BERSIH                                        Rp  xx.xxx.xxx
```

### 14.2 Laporan Posisi Keuangan (Neraca)

Sesuai SAK EMKM Bab 4:

```
LAPORAN POSISI KEUANGAN
[Nama Usaha]
Per [Tanggal]

ASET
  Aset Lancar
    Kas dan Setara Kas                  Rp  xx.xxx.xxx
    Piutang Usaha                       Rp   x.xxx.xxx
    Persediaan                          Rp   x.xxx.xxx
    Total Aset Lancar                                   Rp  xx.xxx.xxx
  
  Aset Tidak Lancar
    Peralatan (Neto)                    Rp  xx.xxx.xxx
    Kendaraan (Neto)                    Rp  xx.xxx.xxx
    Total Aset Tidak Lancar                             Rp  xx.xxx.xxx
  
  TOTAL ASET                                            Rp xxx.xxx.xxx

LIABILITAS DAN EKUITAS
  Liabilitas
    Utang Usaha                         Rp   x.xxx.xxx
    Utang Bank                          Rp  xx.xxx.xxx
    Total Liabilitas                                    Rp  xx.xxx.xxx
  
  Ekuitas
    Modal Pemilik                       Rp  xx.xxx.xxx
    Saldo Laba                          Rp  xx.xxx.xxx
    Total Ekuitas                                       Rp  xx.xxx.xxx
  
  TOTAL LIABILITAS DAN EKUITAS                          Rp xxx.xxx.xxx
```

**Validasi Neraca:** Sistem harus memastikan Total Aset = Total Liabilitas + Ekuitas. Jika tidak balance, tampilkan alert kritis dan blokir generate laporan.

### 14.3 Catatan Atas Laporan Keuangan (CALK)

SAK EMKM mewajibkan CALK minimal berisi:
- Pernyataan kepatuhan terhadap SAK EMKM
- Kebijakan akuntansi signifikan (metode penyusutan, dsb.)
- Informasi tambahan yang relevan

Sistem menyediakan template CALK yang bisa dikustomisasi.

---

## 15. Integrasi

### 15.1 Phase 1 (MVP)

- **Email** (Resend atau Nodemailer): Notifikasi, undangan tim, laporan terjadwal
- **Export PDF**: Menggunakan React-PDF atau Puppeteer (headless Chrome)
- **Export Excel**: SheetJS untuk laporan dalam format .xlsx

### 15.2 Phase 2

- **Import Mutasi Bank** (CSV/Excel): Parsing otomatis format BCA, Mandiri, BNI, BRI
- **WhatsApp Notification** (via Fonnte / WA Business API): Pengingat jatuh tempo
- **Google Drive**: Backup laporan otomatis

### 15.3 Phase 3

- **DJP e-Faktur**: Integrasi API pajak (setelah MVP stabil)
- **Open Banking API**: Sinkronisasi saldo & mutasi rekening
- **Marketplace**: Tokopedia/Shopee API untuk sinkronisasi penjualan

---

## 16. Roadmap & Prioritas

### Phase 1 — MVP (Bulan 1–3)

**Sprint 1–2: Foundation**
- [ ] Setup project (Next.js, Prisma, PostgreSQL, Auth)
- [ ] Database schema & migrasi
- [ ] Authentication (register, login, email verify, forgot password)
- [ ] Multi-tenant basic (create business, switch business)

**Sprint 3–4: Core Accounting**
- [ ] Chart of Accounts (CRUD + template SAK EMKM)
- [ ] Accounting Engine (validasi normal balance, generate jurnal)
- [ ] Transaksi Kas Masuk / Keluar / Transfer
- [ ] Preview jurnal sebelum simpan

**Sprint 5–6: Reporting & Polish**
- [ ] Buku Besar
- [ ] Trial Balance
- [ ] Laporan Laba Rugi
- [ ] Laporan Posisi Keuangan (Neraca)
- [ ] Export PDF & Excel
- [ ] Dashboard summary

### Phase 2 — Growth (Bulan 4–6)

- [ ] Invoice & Piutang
- [ ] Bill & Utang
- [ ] Manajemen Inventori dasar
- [ ] Rekonsiliasi Bank
- [ ] Aset Tetap & Penyusutan
- [ ] Pajak PPN dasar
- [ ] Notifikasi jatuh tempo
- [ ] Laporan Arus Kas
- [ ] Format Laporan BUMDes
- [ ] Tim & Role management

### Phase 3 — Scale (Bulan 7–12)

- [ ] Mobile PWA optimization
- [ ] Import mutasi bank (CSV)
- [ ] WhatsApp notification
- [ ] Payroll dasar
- [ ] Multi-currency
- [ ] AI assistant akuntansi
- [ ] Integrasi marketplace

---

## 17. Non-Functional Requirements

### 17.1 Performa

| Metrik | Target |
|--------|--------|
| Waktu muat halaman awal (LCP) | < 2.5 detik |
| Time to Interactive (TTI) | < 3.5 detik |
| API response time (P95) | < 500ms |
| Generate laporan PDF | < 5 detik |
| Uptime | 99.5% |

### 17.2 Skalabilitas

- Arsitektur horizontal-scalable via container (Docker)
- Database connection pooling via PgBouncer
- Redis caching untuk query laporan yang berat
- CDN untuk aset statis (Cloudflare)

### 17.3 Aksesibilitas

- WCAG 2.1 Level AA
- Keyboard navigable
- Screen reader compatible (ARIA labels)
- Minimum font size 14px untuk form input
- Color contrast ratio > 4.5:1

### 17.4 Kompatibilitas Browser

- Chrome/Edge 90+ (primary)
- Firefox 90+
- Safari 14+ (iOS)
- Mobile Chrome (Android)

---

## 18. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|---------|
| Bug pada engine akuntansi → laporan salah | Sedang | Kritis | Unit test 100% coverage pada Accounting Engine; beta testing dengan akuntan tersertifikasi |
| Data loss | Rendah | Kritis | Backup harian, PITR, multi-region storage |
| Adopsi rendah (pengguna tidak paham akuntansi) | Tinggi | Tinggi | Mode "Sederhana" tanpa jargon, onboarding video, community support |
| Perubahan regulasi pajak/akuntansi | Rendah | Sedang | Abstraksi konfigurasi tarif & akun pajak agar mudah diupdate |
| Konkurensi tinggi → race condition di jurnal | Sedang | Tinggi | Database transaction + optimistic locking di Prisma |
| Keamanan data bocor | Rendah | Kritis | RLS PostgreSQL, audit log, penetration testing sebelum launch |

---

## 19. Glossary

| Istilah | Penjelasan |
|---------|-----------|
| SAK EMKM | Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah — standar resmi IAI untuk UMKM Indonesia |
| CoA | Chart of Accounts — Daftar Akun terstruktur |
| Double-Entry | Prinsip pencatatan akuntansi: setiap transaksi dicatat di minimal 2 akun (Debit & Kredit) dengan jumlah sama |
| Normal Balance | Sisi (Debit/Kredit) dimana saldo normal suatu akun bertambah |
| Trial Balance | Neraca Saldo — daftar semua akun beserta saldo Debit/Kredit, untuk memverifikasi keseimbangan buku besar |
| BUMDes | Badan Usaha Milik Desa — entitas bisnis yang dimiliki pemerintah desa |
| Permendesa | Peraturan Menteri Desa, PDTT — regulasi yang mengatur BUMDes |
| RLS | Row-Level Security — fitur PostgreSQL untuk isolasi data per tenant di level database |
| PITR | Point-in-Time Recovery — kemampuan restore database ke titik waktu tertentu |
| KUR | Kredit Usaha Rakyat — program kredit pemerintah untuk UMKM |
| Void | Pembatalan transaksi yang sudah diposting dengan membuat jurnal pembalik |
| Running Balance | Saldo berjalan yang dihitung secara kumulatif per transaksi |

---

*Dokumen ini adalah living document. Update setiap sprint review.*  
*Versi berikutnya akan menambahkan: Wireframe detail, API specification (OpenAPI), dan Test Plan.*

---

**AkuntansiMu** — Keuangan Bersih, Usaha Maju.
