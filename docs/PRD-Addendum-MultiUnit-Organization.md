# PRD Addendum — Multi-Unit Organization
## BisnisMu

**Versi:** 1.2  
**Tanggal:** 2026-06-03  
**Status:** Approved for Development  
**Melengkapi:** PRD-BisnisMu-v1.0 + Addendum Roles v1.1  
**Keputusan arsitektur:** Additive layer — zero breaking changes ke kode yang ada  

---

## Latar Belakang & Keputusan

### Masalah
BUMDes Hanyukupi (sebagai contoh) memiliki beberapa unit usaha:
- Unit Simpan Pinjam
- Unit Perdagangan
- Unit Pariwisata

Dengan model flat yang ada, ketiga unit ini hanya bisa didaftarkan sebagai `Business` yang **sejajar dan terpisah** — tidak ada hubungan induk-anak, tidak ada laporan konsolidasi, tidak ada shared management di bawah satu lembaga.

### Keputusan yang Sudah Ditetapkan

| Pertanyaan | Jawaban |
|-----------|---------|
| Satu Business bisa masuk lebih dari satu Organization? | **Tidak** — 1 Business hanya bisa milik 1 Organization |
| Perlu eliminasi transaksi antar-unit di laporan konsolidasi? | **Tidak** — laporan konsolidasi adalah agregasi/penjumlahan langsung |
| Laporan per unit tetap tersedia? | **Ya** — akses fleksibel: semua unit atau per unit |
| Apakah kode yang sudah ada perlu diubah? | **Tidak** — purely additive layer |

---

## 1. Konsep Model

```
Organization (Lembaga Induk)
  "BUMDes Hanyukupi"
       │
       ├── Business (Unit Usaha) ← businessId tetap ada, tidak berubah
       │     "Unit Simpan Pinjam"
       │
       ├── Business (Unit Usaha)
       │     "Unit Perdagangan"
       │
       └── Business (Unit Usaha)
             "Unit Pariwisata"
```

**Prinsip utama:**
- Setiap `Business` (unit usaha) tetap beroperasi secara independen dengan `businessId`-nya sendiri
- Semua kode existing (service, repository, domain engine, API routes) **tidak disentuh**
- `Organization` adalah layer baru di atas — murni additive
- Satu `Business` hanya bisa masuk ke **satu** `Organization` (FK, bukan many-to-many)

---

## 2. Skema Database

### 2.1 Perubahan pada Model `Business` (existing)

Tambah **2 kolom optional** saja — tidak ada kolom yang dihapus atau direname:

```prisma
model Business {
  // ... semua kolom yang sudah ada tetap tidak berubah ...
  id           String       @id @default(cuid())
  name         String
  type         BusinessType
  // ... dll ...

  // ✅ TAMBAHKAN INI SAJA:
  organizationId  String?
  organization    Organization? @relation(fields: [organizationId], references: [id])
}
```

### 2.2 Model Baru: `Organization`

```prisma
model Organization {
  id          String        @id @default(cuid())
  name        String                              // "BUMDes Hanyukupi"
  type        OrgType                             // BUMDES | KOPERASI | HOLDING | FRANCHISE
  description String?
  address     String?
  npwpNumber  String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  createdById String                              // userId yang membuat org

  businesses  Business[]                          // unit-unit usaha
  members     OrgMember[]                         // pengelola org
}
```

### 2.3 Model Baru: `OrgMember`

```prisma
model OrgMember {
  organizationId  String
  userId          String
  role            OrgRole     // ORG_OWNER | ORG_ADMIN | ORG_VIEWER
  joinedAt        DateTime    @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id])
  // user         User @relation(...)  ← sambungkan saat auth layer selesai

  @@id([organizationId, userId])
}
```

### 2.4 Enum Baru

```prisma
enum OrgType {
  BUMDES        // Badan Usaha Milik Desa
  KOPERASI      // Koperasi
  HOLDING       // Holding UMKM
  FRANCHISE     // Jaringan waralaba
}

enum OrgRole {
  ORG_OWNER     // Ketua / Direktur BUMDes — akses penuh semua unit
  ORG_ADMIN     // Sekretaris / Bendahara — kelola semua unit, tidak bisa hapus org
  ORG_VIEWER    // Pengawas / Auditor — read-only semua unit
}
```

---

## 3. Permission Matrix

### 3.1 Hubungan OrgRole dan BusinessRole

```
OrgRole.ORG_OWNER  →  otomatis bertindak sebagai ADMIN di semua Business unit-nya
OrgRole.ORG_ADMIN  →  otomatis bertindak sebagai ADMIN di semua Business unit-nya
OrgRole.ORG_VIEWER →  otomatis bertindak sebagai VIEWER di semua Business unit-nya

BusinessRole per unit tetap berlaku untuk akses spesifik per unit.
```

Contoh konkret untuk BUMDes Hanyukupi:

| Orang | OrgRole | Akses ke Simpan Pinjam | Akses ke Pariwisata |
|-------|---------|------------------------|---------------------|
| Direktur BUMDes | ORG_OWNER | ✅ Full (via org) | ✅ Full (via org) |
| Bendahara BUMDes | ORG_ADMIN | ✅ Admin (via org) | ✅ Admin (via org) |
| Pengawas Desa | ORG_VIEWER | 👁 Read-only (via org) | 👁 Read-only (via org) |
| Kasir Simpan Pinjam | — (hanya business role) | ✅ CASHIER | ❌ Tidak bisa akses |

### 3.2 Permission Matrix Lengkap

| Aksi | ORG_OWNER | ORG_ADMIN | ORG_VIEWER |
|------|:---------:|:---------:|:----------:|
| Lihat daftar unit usaha | ✅ | ✅ | ✅ |
| Tambah unit usaha ke org | ✅ | ✅ | ❌ |
| Lepas unit usaha dari org | ✅ | ❌ | ❌ |
| Hapus organization | ✅ | ❌ | ❌ |
| Kelola OrgMember | ✅ | ✅ | ❌ |
| **Laporan per unit usaha** | ✅ | ✅ | ✅ |
| **Laporan konsolidasi semua unit** | ✅ | ✅ | ✅ |
| **Perbandingan antar unit** | ✅ | ✅ | ✅ |
| Input transaksi di unit mana pun | ✅ | ✅ | ❌ |
| Approve/post transaksi | ✅ | ✅ | ❌ |

---

## 4. Laporan: Tiga Mode Akses

### 4.1 Mode 1 — Per Unit Usaha (existing, tidak berubah)

Laporan standar per `businessId` — sama persis seperti sekarang.

```
GET /api/reports/profit-loss?businessId=unit-simpan-pinjam-id
GET /api/reports/balance-sheet?businessId=unit-pariwisata-id
```

Menggunakan `ReportingService` yang sudah ada. **Zero perubahan.**

---

### 4.2 Mode 2 — Konsolidasi Semua Unit (baru)

Agregasi sederhana: jalankan laporan per unit, lalu jumlahkan per baris akun.

```
GET /api/organizations/:orgId/reports/profit-loss?period=2026-01
GET /api/organizations/:orgId/reports/balance-sheet?period=2026-01
```

**Logika konsolidasi:**

```typescript
async getConsolidatedPnL(orgId: string, period: DateRange) {
  // 1. Ambil semua businessId di bawah org ini
  const units = await orgRepo.getBusinessUnits(orgId)

  // 2. Jalankan ReportingService per unit (existing service, zero changes)
  const reports = await Promise.all(
    units.map(unit =>
      reportingService.getIncomeStatement({ businessId: unit.id }, period)
    )
  )

  // 3. Agregasi: sum per account group
  return aggregatePnL(reports)   // fungsi pure — sum revenue, expense, laba
}
```

**Format output konsolidasi:**

```
LAPORAN LABA RUGI KONSOLIDASI
BUMDes Hanyukupi
Periode: Januari 2026

                          Simpan    Perdaga-   Pariwi-    TOTAL
                          Pinjam    ngan       sata       KONSOLIDASI
──────────────────────────────────────────────────────────────────
PENDAPATAN
  Pendapatan Usaha        12.000    8.500      15.200     35.700
  Pendapatan Lain-lain       500      200         800      1.500
  Total Pendapatan        12.500    8.700      16.000     37.200

BEBAN
  HPP                          0    5.200           0      5.200
  Beban Operasional        3.200    1.800       4.100      9.100
  Total Beban              3.200    7.000       4.100     14.300

LABA BERSIH                9.300    1.700      11.900     22.900
──────────────────────────────────────────────────────────────────
(dalam ribuan Rupiah)
```

---

### 4.3 Mode 3 — Perbandingan Antar Unit (baru)

Dashboard kesehatan bisnis — semua unit dalam satu tampilan untuk deteksi unit mana yang perlu perhatian.

```
GET /api/organizations/:orgId/reports/unit-comparison?period=2026-01
```

**Format output:**

```
PERBANDINGAN KESEHATAN UNIT USAHA
BUMDes Hanyukupi — Januari 2026

Unit Usaha        Pendapatan   Laba Bersih   Margin    Status
──────────────────────────────────────────────────────────────
Simpan Pinjam     12.500.000    9.300.000    74,4%     🟢 Sehat
Pariwisata        16.000.000   11.900.000    74,4%     🟢 Sehat
Perdagangan        8.700.000    1.700.000    19,5%     🟡 Perlu Perhatian
──────────────────────────────────────────────────────────────
TOTAL BUMDes      37.200.000   22.900.000    61,6%
```

**Threshold status kesehatan (configurable):**
- 🟢 Sehat: margin ≥ 30%
- 🟡 Perlu Perhatian: margin 10%–30%
- 🔴 Kritis: margin < 10% atau rugi

---

## 5. API Routes Baru

Semua route baru menggunakan prefix `/api/organizations` — tidak ada konflik dengan route existing.

```
POST   /api/organizations                          — Buat organization baru
GET    /api/organizations                          — List org milik user
GET    /api/organizations/:orgId                   — Detail org
PATCH  /api/organizations/:orgId                   — Update org
DELETE /api/organizations/:orgId                   — Hapus org (ORG_OWNER only)

POST   /api/organizations/:orgId/units             — Tambah Business ke org
DELETE /api/organizations/:orgId/units/:businessId — Lepas Business dari org

POST   /api/organizations/:orgId/members           — Undang member
PATCH  /api/organizations/:orgId/members/:userId   — Ubah role member
DELETE /api/organizations/:orgId/members/:userId   — Keluarkan member

GET    /api/organizations/:orgId/reports/profit-loss       — Konsolidasi P&L
GET    /api/organizations/:orgId/reports/balance-sheet     — Konsolidasi Neraca
GET    /api/organizations/:orgId/reports/unit-comparison   — Perbandingan unit
GET    /api/organizations/:orgId/dashboard                 — Dashboard konsolidasi
```

---

## 6. Service Architecture

### 6.1 File Baru yang Perlu Dibuat

```
src/features/organization/
├── domain/
│   ├── organization.types.ts      — OrgType, OrgRole, interfaces
│   └── organization.engine.ts     — Validasi, health score calculation
├── application/
│   ├── organization.service.ts    — CRUD org + member management
│   ├── organization.repository.ts — Repository port (interface)
│   └── consolidation.service.ts   — Laporan konsolidasi & perbandingan
└── infrastructure/
    └── prisma-organization-repository.ts

app/api/organizations/
├── route.ts                       — POST/GET /api/organizations
├── [orgId]/
│   ├── route.ts                   — GET/PATCH/DELETE
│   ├── units/route.ts             — POST/DELETE unit usaha
│   ├── members/route.ts           — POST member
│   ├── members/[userId]/route.ts  — PATCH/DELETE member
│   └── reports/
│       ├── profit-loss/route.ts
│       ├── balance-sheet/route.ts
│       ├── unit-comparison/route.ts
│       └── dashboard/route.ts
```

### 6.2 ConsolidationService (Inti Fitur Baru)

```typescript
export class ConsolidationService {
  constructor(
    private orgRepo: IOrganizationRepository,
    private reportingService: ReportingService   // ← existing service, inject as-is
  ) {}

  async getConsolidatedPnL(
    orgId: string,
    period: { from: Date; to: Date }
  ): Promise<ConsolidatedPnL> {
    const units = await this.orgRepo.getBusinessUnits(orgId)

    const reports = await Promise.all(
      units.map(unit =>
        this.reportingService.getIncomeStatement(
          { businessId: unit.id, actorUserId: 'system' },
          period
        )
      )
    )

    return {
      organizationId: orgId,
      period,
      units: units.map((unit, i) => ({
        businessId: unit.id,
        name: unit.name,
        report: reports[i]
      })),
      consolidated: this.aggregatePnL(reports)
    }
  }

  async getUnitComparison(
    orgId: string,
    period: { from: Date; to: Date }
  ): Promise<UnitComparison[]> {
    const consolidated = await this.getConsolidatedPnL(orgId, period)

    return consolidated.units.map(unit => ({
      businessId: unit.businessId,
      name: unit.name,
      revenue: unit.report.totalRevenue,
      netProfit: unit.report.netProfit,
      margin: unit.report.totalRevenue > 0n
        ? Number(unit.report.netProfit * 100n / unit.report.totalRevenue)
        : 0,
      healthStatus: this.calcHealthStatus(unit.report)
    }))
  }

  private calcHealthStatus(report: IncomeStatement): HealthStatus {
    if (report.totalRevenue === 0n) return 'NO_DATA'
    const margin = Number(report.netProfit * 100n / report.totalRevenue)
    if (margin >= 30) return 'HEALTHY'
    if (margin >= 10) return 'WATCH'
    return 'CRITICAL'
  }

  private aggregatePnL(reports: IncomeStatement[]): AggregatedPnL {
    // Sum setiap line item across all units
    return {
      totalRevenue: reports.reduce((sum, r) => sum + r.totalRevenue, 0n),
      totalExpense: reports.reduce((sum, r) => sum + r.totalExpense, 0n),
      netProfit:    reports.reduce((sum, r) => sum + r.netProfit, 0n),
    }
  }
}
```

### 6.3 Registrasi di server-services.ts

Tambah di bagian bawah `server-services.ts` — tidak mengubah yang sudah ada:

```typescript
// Tambah ini saja — semua existing services tidak berubah
export const orgServices = {
  organization: new OrganizationService(new PrismaOrganizationRepository()),
  consolidation: new ConsolidationService(
    new PrismaOrganizationRepository(),
    serverServices.reporting    // ← inject existing ReportingService
  ),
}
```

---

## 7. Urutan Implementasi (Development Order)

Ikuti urutan ini untuk zero regression:

### Step 1 — Prisma Migration (1–2 jam)
```bash
# Tambah Organization, OrgMember, enum baru
# Tambah organizationId optional di Business
npx prisma migrate dev --name add_organization_layer
```
Tidak ada breaking change — kolom `organizationId` nullable, semua data existing tetap valid.

### Step 2 — Domain & Repository (2–3 jam)
- Buat `organization.types.ts`
- Buat `organization.engine.ts` (validasi nama, role assignment rules)
- Buat `IOrganizationRepository` interface
- Buat `PrismaOrganizationRepository` (CRUD + getBusinessUnits)

### Step 3 — OrganizationService (2–3 jam)
- `createOrganization()`
- `addBusinessUnit(businessId)` — set `organizationId` di Business
- `removeBusinessUnit(businessId)` — set `organizationId = null`
- `inviteMember()`, `updateMemberRole()`, `removeMember()`

### Step 4 — ConsolidationService (3–4 jam)
- `getConsolidatedPnL()`
- `getConsolidatedBalanceSheet()`
- `getUnitComparison()` + health score

### Step 5 — API Routes (2–3 jam)
- CRUD `/api/organizations/*`
- Report routes `/api/organizations/:orgId/reports/*`
- Zod validation schemas

### Step 6 — Tests (2–3 jam)
- Unit test: `ConsolidationService` (mock ReportingService)
- Unit test: `OrganizationEngine` validasi
- Integration test: full org → units → consolidation flow

**Total estimasi: 12–18 jam dev time**

---

## 8. Onboarding Flow untuk BUMDes

### Flow: Direktur BUMDes Hanyukupi setup akun

```
1. Daftar akun user (existing flow)
2. Buat Organization baru
   - Nama: "BUMDes Hanyukupi"
   - Tipe: BUMDES
3. Buat Business pertama: "Unit Simpan Pinjam"
   - Setup CoA, buka periode
   - Attach ke Organization Hanyukupi
4. Buat Business kedua: "Unit Pariwisata"
   - Setup CoA, buka periode
   - Attach ke Organization Hanyukupi
5. Undang Bendahara BUMDes → OrgRole: ORG_ADMIN
   - Otomatis bisa kelola semua unit
6. Undang Pengawas Desa → OrgRole: ORG_VIEWER
   - Otomatis read-only ke semua unit

Selesai — direktur bisa:
✅ Lihat laporan per unit (Simpan Pinjam saja)
✅ Lihat laporan konsolidasi (semua unit digabung)
✅ Bandingkan kesehatan antar unit dalam satu dashboard
```

---

## 9. Hal yang Tidak Berubah (Konfirmasi)

Ini penting untuk developer — semua berikut **tetap sama persis**:

- ✅ Semua `TenantContext { businessId, actorUserId }` — tidak ada perubahan signature
- ✅ Semua domain engine (AccountingEngine, RevenueEngine, dll.)
- ✅ Semua application service (CashService, RevenueService, SalesService, dll.)
- ✅ Semua repository existing dan Prisma queries
- ✅ Semua 40+ API routes yang sudah ada
- ✅ Semua 149 unit tests — tidak ada yang rusak
- ✅ Journal posting flow, idempotency keys, concurrency locks
- ✅ RBAC per-business (BusinessMember roles) — tetap berlaku

---

## 10. Catatan untuk CLAUDE.md

Tambahkan section ini ke CLAUDE.md setelah section Core Modules:

```markdown
## Multi-Unit Organization

BisnisMu mendukung dua model penggunaan:

**Model Flat (default):**
User mengelola satu atau beberapa Business secara independen.
Cocok untuk UMKM biasa.

**Model Hierarki (opsional):**
Satu Organization (lembaga induk) menaungi beberapa Business (unit usaha).
Cocok untuk BUMDes, koperasi, atau holding UMKM.

Aturan:
- Satu Business hanya bisa masuk ke satu Organization
- Tidak ada eliminasi transaksi antar unit (agregasi langsung)
- Laporan tersedia: per unit, konsolidasi semua unit, perbandingan antar unit
- OrgRole (ORG_OWNER/ORG_ADMIN/ORG_VIEWER) cascade ke semua Business di bawah org

File utama:
- src/features/organization/ — domain, service, repository
- src/features/organization/application/consolidation.service.ts — laporan konsolidasi
- app/api/organizations/ — API routes
```

---

*Dokumen ini final dan siap untuk development.*  
*Tidak ada pertanyaan terbuka — semua keputusan arsitektur sudah ditetapkan.*

**BisnisMu** — Satu platform, banyak unit, satu laporan konsolidasi.
