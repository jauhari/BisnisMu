# PRD Addendum — User Roles & God Mode (Super Admin)
## BisnisMu

**Versi:** 1.1  
**Tanggal:** 30 Mei 2026  
**Status:** Draft  
**Melengkapi:** PRD-BisnisMu-v1.0 (Bagian 10.2)

---

## Daftar Isi

1. [Gambaran Sistem Role](#1-gambaran-sistem-role)
2. [Role Level 1 — Platform (God Mode)](#2-role-level-1--platform-god-mode)
3. [Role Level 2 — Per Usaha (Business Role)](#3-role-level-2--per-usaha-business-role)
4. [Permission Matrix Lengkap](#4-permission-matrix-lengkap)
5. [God Mode — Fitur Detail](#5-god-mode--fitur-detail)
6. [Audit & Keamanan God Mode](#6-audit--keamanan-god-mode)
7. [Skema Database Role](#7-skema-database-role)
8. [Implementasi & Guard](#8-implementasi--guard)
9. [UI God Mode (Admin Panel)](#9-ui-god-mode-admin-panel)

---

## 1. Gambaran Sistem Role

BisnisMu menggunakan **2 lapisan role yang independen**:

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM LEVEL                           │
│  SUPER_ADMIN  │  SUPPORT_AGENT  │  FINANCE_ADMIN  │  USER  │
│  (God Mode)   │                 │                 │        │
└───────────────────────────┬─────────────────────────────────┘
                            │ User biasa masuk ke sini
┌───────────────────────────▼─────────────────────────────────┐
│                   BUSINESS LEVEL (per usaha)                │
│    OWNER    │    ADMIN    │    EDITOR    │    VIEWER         │
└─────────────────────────────────────────────────────────────┘
```

**Prinsip penting:**
- Platform role dan business role adalah **dua sistem terpisah**
- Seorang `SUPER_ADMIN` tetap bisa punya usaha sendiri dengan business role `OWNER`
- God Mode aktif hanya saat masuk ke **Admin Panel** — bukan di UI normal
- Semua aksi God Mode **wajib tercatat di audit log** tanpa pengecualian

---

## 2. Role Level 1 — Platform (God Mode)

### 2.1 Daftar Platform Role

| Role | Kode | Deskripsi |
|------|------|-----------|
| Super Admin | `SUPER_ADMIN` | Akses penuh ke semua fitur platform & semua data tenant. Hanya bisa di-assign oleh Super Admin lain. Maksimal 3 orang. |
| Support Agent | `SUPPORT_AGENT` | Akses read-only ke data user & usaha untuk keperluan support. Tidak bisa mengubah data keuangan. |
| Finance Admin | `FINANCE_ADMIN` | Kelola billing, subscription, refund, invoice platform. Tidak bisa akses data akuntansi tenant. |
| Developer | `DEVELOPER` | Akses log sistem, feature flags, API monitoring. Tidak bisa akses data user atau keuangan. |
| Regular User | `USER` | Default untuk semua pengguna yang mendaftar. Tidak punya akses platform admin. |

### 2.2 Hierarki & Assignment

```
SUPER_ADMIN  ──can assign──►  SUPPORT_AGENT
             ──can assign──►  FINANCE_ADMIN
             ──can assign──►  DEVELOPER
             ──can assign──►  SUPER_ADMIN (maks 3, butuh konfirmasi 2FA)

SUPPORT_AGENT, FINANCE_ADMIN, DEVELOPER  ──CANNOT assign──►  siapapun
```

**Aturan kritis:**
- Role `SUPER_ADMIN` tidak bisa di-assign melalui UI biasa — harus via **CLI command** di server atau konfirmasi dari 2 Super Admin yang aktif (four-eyes principle)
- Jumlah `SUPER_ADMIN` aktif dibatasi maksimal **5 akun**
- `SUPER_ADMIN` wajib mengaktifkan 2FA sebelum bisa login ke Admin Panel

---

## 3. Role Level 2 — Per Usaha (Business Role)

### 3.1 Daftar Business Role

| Role | Kode | Deskripsi |
|------|------|-----------|
| Pemilik | `OWNER` | Pemilik usaha. Akses penuh, termasuk hapus usaha & kelola billing. Maksimal 1 per usaha. |
| Admin | `ADMIN` | Manajer / akuntan kepercayaan. Akses hampir penuh kecuali hapus usaha & billing. |
| Editor | `EDITOR` | Staf input data. Bisa buat & edit transaksi draft. Tidak bisa approve/post atau ubah pengaturan. |
| Viewer | `VIEWER` | Akses baca saja. Cocok untuk investor, auditor eksternal, atau pimpinan yang hanya perlu lihat laporan. |
| Akuntan Eksternal | `ACCOUNTANT` | Seperti Viewer + bisa export semua laporan & tambah jurnal manual. Tidak bisa input transaksi kasir. |
| Kasir | `CASHIER` | Hanya bisa input Kas Masuk & Kas Keluar. Tidak bisa lihat laporan atau pengaturan. |

### 3.2 Aturan Business Role

- Setiap usaha **wajib memiliki tepat 1 OWNER**
- Transfer ownership: Owner lama harus konfirmasi email, lalu Owner baru konfirmasi email
- Jika Owner menghapus akun platform-nya, usaha masuk status **"Orphaned"** — sistem notifikasi Admin usaha untuk claim ownership dalam 30 hari
- Satu user bisa punya role berbeda di usaha yang berbeda (misal: OWNER di Usaha A, VIEWER di Usaha B)

---

## 4. Permission Matrix Lengkap

### 4.1 Business-Level Permissions

| Permission | OWNER | ADMIN | EDITOR | VIEWER | ACCOUNTANT | CASHIER |
|-----------|:-----:|:-----:|:------:|:------:|:----------:|:-------:|
| **TRANSAKSI** |
| Lihat daftar transaksi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (milik sendiri) |
| Buat transaksi (draft) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (kas saja) |
| Edit transaksi (draft) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (milik sendiri) |
| Post / approve transaksi | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Void transaksi | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **JURNAL** |
| Lihat jurnal | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Buat jurnal manual | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **LAPORAN** |
| Lihat semua laporan | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export laporan (PDF/Excel) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **AKUN & PENGATURAN** |
| Lihat Chart of Accounts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kelola Chart of Accounts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pengaturan usaha | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **TIM** |
| Lihat daftar anggota | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Undang anggota | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ubah role anggota | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hapus anggota | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **BILLING** |
| Lihat status langganan | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Upgrade / downgrade plan | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hapus usaha | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.2 Platform-Level Permissions (God Mode)

| Permission | SUPER_ADMIN | SUPPORT_AGENT | FINANCE_ADMIN | DEVELOPER |
|-----------|:-----------:|:-------------:|:-------------:|:---------:|
| **USER MANAGEMENT** |
| Lihat semua user | ✅ | ✅ | ❌ | ❌ |
| Suspend / ban user | ✅ | ❌ | ❌ | ❌ |
| Reset password user | ✅ | ✅ | ❌ | ❌ |
| Hapus akun user | ✅ | ❌ | ❌ | ❌ |
| Impersonate user | ✅ | ✅ (read-only) | ❌ | ❌ |
| Assign platform role | ✅ | ❌ | ❌ | ❌ |
| **BUSINESS / TENANT** |
| Lihat semua usaha | ✅ | ✅ | ❌ | ❌ |
| Lihat data keuangan tenant | ✅ | ✅ (read-only) | ❌ | ❌ |
| Edit data keuangan tenant | ✅ | ❌ | ❌ | ❌ |
| Hapus usaha | ✅ | ❌ | ❌ | ❌ |
| Override subscription limit | ✅ | ❌ | ✅ | ❌ |
| **BILLING PLATFORM** |
| Lihat semua invoice & revenue | ✅ | ❌ | ✅ | ❌ |
| Proses refund | ✅ | ❌ | ✅ | ❌ |
| Extend trial period | ✅ | ❌ | ✅ | ❌ |
| **SISTEM** |
| Feature flags | ✅ | ❌ | ❌ | ✅ |
| Lihat system logs | ✅ | ❌ | ❌ | ✅ |
| Lihat API metrics | ✅ | ❌ | ❌ | ✅ |
| Maintenance mode | ✅ | ❌ | ❌ | ❌ |
| Database direct query | ✅ | ❌ | ❌ | ❌ |
| **AUDIT** |
| Lihat audit log semua user | ✅ | ✅ | ❌ | ❌ |
| Export audit log | ✅ | ❌ | ❌ | ❌ |

---

## 5. God Mode — Fitur Detail

### 5.1 Akses Admin Panel

God Mode diakses melalui subdomain atau path terpisah:
```
https://admin.bisnismu.id   ← recommended (subdomain terpisah)
atau
https://bisnismu.id/god     ← alternatif (path-based)
```

**Requirement akses:**
1. Akun harus memiliki platform role `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`, atau `DEVELOPER`
2. 2FA wajib aktif dan dikonfirmasi saat login ke admin panel
3. Session Admin Panel terpisah dari session user biasa (token berbeda)
4. Session Admin Panel expire dalam **2 jam** (tidak bisa di-extend, harus login ulang)
5. IP Whitelist opsional per environment (direkomendasikan untuk production)

### 5.2 Dashboard God Mode

Halaman utama admin panel menampilkan:

```
┌─────────────────────────────────────────────────────────────┐
│  🔴 ADMIN PANEL — BisnisMu                    [Logout]   │
│  Login sebagai: Andi Pratama (SUPER_ADMIN)                  │
│  Session expires: 1:45:23                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Platform Overview                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Total   │ │  Total   │ │   MAU    │ │  MRR     │      │
│  │  Users   │ │ Business │ │          │ │          │      │
│  │  12.450  │ │  8.234   │ │  6.102   │ │ Rp 45jt  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  Recent Activity    │  System Health                       │
│  [Audit log 10 row] │  DB: ✅  Redis: ✅  Queue: ✅        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 User Management

**Lihat & cari semua user:**
- Search by: nama, email, ID, nomor telepon
- Filter by: status (aktif/suspended/unverified), platform role, tanggal daftar, plan
- Export daftar user ke CSV

**Aksi per user:**
```
View Detail User
├── Info akun (email, tanggal daftar, last login, IP terakhir)
├── Daftar usaha yang dimiliki / diikuti
├── Riwayat billing & invoice
├── Audit log aktivitas user
└── Aksi:
    ├── [Reset Password]     → kirim email reset, catat di audit log
    ├── [Suspend]            → user tidak bisa login, usahanya tetap ada
    ├── [Unsuspend]
    ├── [Verify Email Manual]→ bypass email verification (untuk support)
    ├── [Impersonate]        → masuk sebagai user (lihat 5.4)
    └── [Hapus Akun]         → soft delete, butuh konfirmasi teks "HAPUS"
```

### 5.4 Impersonate (Login sebagai User Lain)

Fitur paling sensitif di God Mode. Memungkinkan admin melihat tampilan persis seperti yang dilihat user — sangat berguna untuk debugging support ticket.

**Alur Impersonate:**
```
1. Admin klik [Impersonate] di halaman detail user
2. Sistem tampilkan modal konfirmasi:
   "Anda akan masuk sebagai [Nama User].
    Alasan impersonasi: [wajib diisi, min 20 karakter]
    Semua aksi Anda akan dicatat atas nama Anda, bukan user ini."
3. Admin isi alasan → klik Konfirmasi
4. Tab baru terbuka → UI normal BisnisMu sebagai user tersebut
5. Banner merah permanen di atas UI:
   ┌──────────────────────────────────────────────────────────┐
   │ 🔴 GOD MODE AKTIF — Anda login sebagai: Ibu Sari        │
   │ Alasan: Membantu debug error laporan laba rugi           │
   │                              [Keluar dari God Mode]      │
   └──────────────────────────────────────────────────────────┘
6. Semua aksi yang dilakukan tercatat di audit log dengan flag
   `impersonated_by: admin_id`
7. Session impersonate expire otomatis dalam 30 menit
8. User yang di-impersonate TIDAK mendapat notifikasi (untuk menghindari
   panic saat support sedang debug) — tapi tercatat di audit log mereka
```

**Batasan selama impersonate:**
- Tidak bisa ubah password, email, atau 2FA user
- Tidak bisa hapus data permanen (void transaksi tetap bisa untuk support)
- Tidak bisa akses billing user
- `SUPPORT_AGENT` hanya bisa impersonate dalam mode **read-only** (semua tombol submit dinonaktifkan)

### 5.5 Business / Tenant Management

**Lihat semua usaha:**
- Search by: nama usaha, ID, nama owner
- Filter by: tipe usaha, plan, status (aktif/suspended/orphaned)
- Statistik: jumlah transaksi, jumlah anggota, storage digunakan

**Aksi per usaha:**
```
View Detail Usaha
├── Info umum (nama, tipe, owner, tanggal buat, plan)
├── Daftar anggota & role mereka
├── Statistik penggunaan
├── Riwayat billing
└── Aksi:
    ├── [Lihat Data Akuntansi]  → read-only view ke dashboard usaha
    ├── [Override Plan Limit]   → extend limit sementara (maks 30 hari)
    ├── [Suspend Usaha]         → user tidak bisa akses usaha ini
    ├── [Transfer Ownership]    → pindah owner (butuh konfirmasi email owner baru)
    └── [Hapus Usaha]           → butuh konfirmasi teks nama usaha + alasan
```

### 5.6 Platform Configuration

Pengaturan global platform yang hanya bisa diubah `SUPER_ADMIN`:

```yaml
Feature Flags:
  - maintenance_mode: false
  - new_user_registration: true
  - invoice_module: true (phase 2)
  - bumdes_report: false (phase 2)
  - ai_assistant: false (phase 3)

Plan Limits (override default):
  - free.max_businesses: 1
  - free.max_transactions_per_month: 100
  - starter.max_businesses: 3

System Notifications:
  - global_announcement: ""  (tampil di semua user saat login)
  - maintenance_window: null
```

### 5.7 Billing & Subscription Management

Untuk `FINANCE_ADMIN` dan `SUPER_ADMIN`:

- Lihat MRR, ARR, churn rate, new subscriptions per hari/bulan
- Lihat semua invoice platform yang dikirim ke user
- Proses refund manual dengan catatan alasan
- Extend masa trial (input tanggal berakhir baru)
- Override plan user (upgrade/downgrade tanpa pembayaran — untuk kasus khusus seperti BUMDes yang mengajukan subsidi)

### 5.8 System Monitoring

Untuk `DEVELOPER` dan `SUPER_ADMIN`:

- Realtime: request rate, error rate, latency P50/P95/P99
- Queue status: pending jobs, failed jobs, processing time
- Database metrics: active connections, slow queries, table sizes
- Error tracker integration (Sentry dashboard embed)
- Feature flag management

---

## 6. Audit & Keamanan God Mode

### 6.1 Audit Log — God Mode Actions

**Setiap aksi di Admin Panel wajib dicatat dengan format:**

```typescript
interface GodModeAuditLog {
  id: string
  timestamp: DateTime
  adminId: string           // Siapa yang melakukan
  adminEmail: string        // Email admin (snapshot saat itu)
  adminRole: PlatformRole   // Role saat aksi dilakukan
  targetType: 'USER' | 'BUSINESS' | 'SYSTEM' | 'BILLING'
  targetId: string          // ID user/usaha yang dikenai aksi
  action: string            // e.g. "USER_SUSPENDED", "IMPERSONATE_START"
  reason: string            // Alasan yang diisi admin (wajib untuk aksi destruktif)
  metadata: JSON            // Data tambahan (IP, user agent, before/after state)
  ipAddress: string
  sessionId: string
}
```

**Aksi yang selalu dicatat (tanpa pengecualian):**
- Login & logout ke Admin Panel
- Setiap kali impersonate dimulai dan diakhiri
- Suspend / unsuspend user atau usaha
- Reset password user
- Perubahan platform role
- Hapus user atau usaha
- Override plan atau billing
- Perubahan feature flags
- Akses ke data keuangan tenant

### 6.2 Keamanan Tambahan God Mode

**Rate Limiting:**
- Max 10 aksi destruktif (suspend, hapus, reset password) per jam per admin
- Jika terlampaui → session diakhiri + notifikasi ke Super Admin lain

**Notifikasi Silang:**
- Setiap aksi `SUPER_ADMIN` dikirim notifikasi email ke semua `SUPER_ADMIN` aktif lainnya
- Aksi `SUPPORT_AGENT` direkap harian dan dikirim ke `SUPER_ADMIN`

**Dead Man's Switch:**
- Jika tidak ada `SUPER_ADMIN` yang login dalam 90 hari → sistem otomatis kirim alert ke email recovery yang didaftarkan saat setup
- Mencegah situasi di mana semua Super Admin tidak bisa akses (locked out)

**Separation of Duties:**
- `FINANCE_ADMIN` tidak bisa lihat data keuangan tenant → mencegah conflict of interest
- `SUPPORT_AGENT` tidak bisa proses billing → mencegah fraud internal
- `DEVELOPER` tidak bisa lihat data user → privacy by design

---

## 7. Skema Database Role

### 7.1 Tambahan ke Prisma Schema

```prisma
// Enum platform role
enum PlatformRole {
  SUPER_ADMIN
  SUPPORT_AGENT
  FINANCE_ADMIN
  DEVELOPER
  USER
}

// Enum business role
enum BusinessRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
  ACCOUNTANT
  CASHIER
}

// Update model User
model User {
  id             String        @id @default(cuid())
  email          String        @unique
  name           String
  passwordHash   String
  platformRole   PlatformRole  @default(USER)
  emailVerified  Boolean       @default(false)
  twoFactorEnabled Boolean     @default(false)
  twoFactorSecret  String?     // encrypted
  status         UserStatus    @default(ACTIVE)  // ACTIVE | SUSPENDED | DELETED
  suspendedAt    DateTime?
  suspendedReason String?
  deletedAt      DateTime?     // soft delete
  lastLoginAt    DateTime?
  lastLoginIp    String?
  createdAt      DateTime      @default(now())
  
  memberships    BusinessMember[]
  sessions       Session[]
  godModeActions GodModeAuditLog[] @relation("AdminActions")
  godModeTargets GodModeAuditLog[] @relation("TargetUser")
}

// Update BusinessMember
model BusinessMember {
  userId     String
  businessId String
  role       BusinessRole
  invitedBy  String?
  invitedAt  DateTime?
  joinedAt   DateTime      @default(now())
  
  user       User          @relation(fields: [userId], references: [id])
  business   Business      @relation(fields: [businessId], references: [id])
  @@id([userId, businessId])
}

// Audit log khusus God Mode
model GodModeAuditLog {
  id           String      @id @default(cuid())
  timestamp    DateTime    @default(now())
  adminId      String
  adminEmail   String
  adminRole    PlatformRole
  targetType   String      // USER | BUSINESS | SYSTEM | BILLING
  targetId     String?
  targetUserId String?
  action       String      // e.g. "USER_SUSPENDED"
  reason       String?
  metadata     Json?
  ipAddress    String
  sessionId    String
  
  admin        User        @relation("AdminActions", fields: [adminId], references: [id])
  targetUser   User?       @relation("TargetUser", fields: [targetUserId], references: [id])
  
  @@index([adminId])
  @@index([targetId])
  @@index([action])
  @@index([timestamp])
}

// Impersonate session tracking
model ImpersonateSession {
  id              String    @id @default(cuid())
  adminId         String
  targetUserId    String
  reason          String
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  isReadOnly      Boolean   @default(false)
  ipAddress       String
}
```

---

## 8. Implementasi & Guard

### 8.1 Middleware Guard (Next.js)

```typescript
// middleware.ts

import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })
  const path = req.nextUrl.pathname

  // Guard Admin Panel — hanya platform role tertentu
  if (path.startsWith("/god") || path.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login?next=/god", req.url))
    }
    
    const allowedRoles = ["SUPER_ADMIN", "SUPPORT_AGENT", "FINANCE_ADMIN", "DEVELOPER"]
    if (!allowedRoles.includes(token.platformRole as string)) {
      return NextResponse.redirect(new URL("/403", req.url))
    }
    
    // Cek 2FA sudah diaktifkan
    if (!token.twoFactorVerified) {
      return NextResponse.redirect(new URL("/2fa/verify?next=/god", req.url))
    }
  }

  return NextResponse.next()
}
```

### 8.2 Permission Helper

```typescript
// lib/permissions.ts

type BusinessRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | "ACCOUNTANT" | "CASHIER"
type PlatformRole = "SUPER_ADMIN" | "SUPPORT_AGENT" | "FINANCE_ADMIN" | "DEVELOPER" | "USER"

const BUSINESS_PERMISSIONS = {
  "transaction:create":   ["OWNER", "ADMIN", "EDITOR", "CASHIER"],
  "transaction:post":     ["OWNER", "ADMIN"],
  "transaction:void":     ["OWNER", "ADMIN"],
  "journal:create":       ["OWNER", "ADMIN", "ACCOUNTANT"],
  "report:view":          ["OWNER", "ADMIN", "EDITOR", "VIEWER", "ACCOUNTANT"],
  "report:export":        ["OWNER", "ADMIN", "EDITOR", "VIEWER", "ACCOUNTANT"],
  "coa:manage":           ["OWNER", "ADMIN"],
  "team:invite":          ["OWNER", "ADMIN"],
  "team:manage":          ["OWNER", "ADMIN"],
  "billing:manage":       ["OWNER"],
  "business:delete":      ["OWNER"],
} as const

const PLATFORM_PERMISSIONS = {
  "user:view":            ["SUPER_ADMIN", "SUPPORT_AGENT"],
  "user:suspend":         ["SUPER_ADMIN"],
  "user:impersonate":     ["SUPER_ADMIN", "SUPPORT_AGENT"],
  "user:delete":          ["SUPER_ADMIN"],
  "tenant:view":          ["SUPER_ADMIN", "SUPPORT_AGENT"],
  "tenant:edit":          ["SUPER_ADMIN"],
  "billing:manage":       ["SUPER_ADMIN", "FINANCE_ADMIN"],
  "system:config":        ["SUPER_ADMIN"],
  "system:flags":         ["SUPER_ADMIN", "DEVELOPER"],
  "system:logs":          ["SUPER_ADMIN", "DEVELOPER"],
} as const

export function canDoBusinessAction(
  role: BusinessRole,
  action: keyof typeof BUSINESS_PERMISSIONS
): boolean {
  return BUSINESS_PERMISSIONS[action].includes(role as never)
}

export function canDoPlatformAction(
  role: PlatformRole,
  action: keyof typeof PLATFORM_PERMISSIONS
): boolean {
  return PLATFORM_PERMISSIONS[action].includes(role as never)
}
```

### 8.3 API Route Guard

```typescript
// lib/api-guard.ts

import { getServerSession } from "next-auth"
import { canDoBusinessAction, canDoPlatformAction } from "./permissions"

// Guard untuk endpoint business
export async function requireBusinessRole(
  businessId: string,
  action: string,
  session: Session
) {
  const member = await prisma.businessMember.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } }
  })
  
  if (!member) throw new ForbiddenError("Bukan anggota usaha ini")
  if (!canDoBusinessAction(member.role, action)) 
    throw new ForbiddenError(`Role ${member.role} tidak bisa melakukan ${action}`)
  
  return member
}

// Guard untuk endpoint God Mode
export async function requirePlatformRole(
  action: string,
  session: Session
) {
  if (!canDoPlatformAction(session.user.platformRole, action))
    throw new ForbiddenError("Akses ditolak — insufficient platform role")
  
  // Catat di audit log
  await logGodModeAction({
    adminId: session.user.id,
    action,
    sessionId: session.id,
    ipAddress: getClientIp(),
  })
}
```

---

## 9. UI God Mode (Admin Panel)

### 9.1 Navigasi Admin Panel

```
Admin Panel Sidebar:
├── 📊 Dashboard Platform
├── 👥 Manajemen User
│   ├── Daftar Semua User
│   ├── User Suspended
│   └── Undangan Pending
├── 🏢 Manajemen Usaha
│   ├── Daftar Semua Usaha
│   ├── Usaha Orphaned
│   └── Usaha Suspended
├── 💳 Billing & Revenue      [FINANCE_ADMIN+]
│   ├── Overview Revenue
│   ├── Invoice Platform
│   └── Refund
├── ⚙️ Konfigurasi Sistem     [SUPER_ADMIN only]
│   ├── Feature Flags
│   ├── Plan Limits
│   └── Global Announcement
├── 📋 Audit Log              [SUPER_ADMIN, SUPPORT_AGENT]
├── 📈 System Monitoring      [DEVELOPER+]
└── 🔒 Platform Admins        [SUPER_ADMIN only]
    ├── Daftar Admin
    └── Assign / Revoke Role
```

### 9.2 Visual Indicator God Mode

Saat seseorang dengan platform role login ke aplikasi normal (bukan admin panel), tidak ada perubahan visual — mereka terlihat seperti user biasa. God Mode hanya aktif saat di Admin Panel.

Saat **Impersonate aktif**, banner merah permanen muncul:

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 MODE IMPERSONATE AKTIF  •  Anda melihat sebagai:     │
│    Ibu Sari Dewi (sari@warungmakan.id)                  │
│    Semua aksi dicatat • Session berakhir: 23:45         │
│                                    [Akhiri Impersonate] │
└─────────────────────────────────────────────────────────┘
```

---

## Ringkasan Perubahan ke PRD v1.0

| Bagian PRD | Perubahan |
|-----------|-----------|
| Bagian 10.2 (Role per Usaha) | Diperluas: tambah role ACCOUNTANT dan CASHIER |
| Bagian 12 (Keamanan) | Tambah: 2FA wajib untuk Admin Panel, IP whitelist, session expiry 2 jam |
| Skema Database | Tambah: field platformRole di User, model GodModeAuditLog, ImpersonateSession |
| Navigasi | Tidak berubah — Admin Panel di subdomain terpisah |
| Roadmap | God Mode & Admin Panel masuk **Phase 1 Sprint 1** — harus ada sebelum launch |

---

*Addendum ini adalah bagian tidak terpisahkan dari PRD-BisnisMu-v1.0*  
*Versi berikutnya: Wireframe Admin Panel & API spec endpoint /admin/*
