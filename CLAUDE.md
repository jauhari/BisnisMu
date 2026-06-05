# CLAUDE.md — BisnisMu Development Guide

**Project:** BisnisMu — Aplikasi Akuntansi untuk UMKM & BUMDes  
**Last Updated:** 2026-06-05  
**Version:** 0.6.0 + Development Guidelines  

---

## 📌 TABLE OF CONTENTS

1. [Core Development Principles](#1-core-development-principles)
2. [Project Overview](#2-project-overview)
3. [Technology Stack](#3-technology-stack)
4. [Architecture & Design](#4-architecture--design)
5. [Quick Start](#5-quick-start)
6. [Core Modules](#6-core-modules)
7. [Multi-Unit Organization](#7-multi-unit-organization)
8. [Database Schema](#8-database-schema)
9. [Current System Status](#9-current-system-status)
10. [Roles & Permissions](#10-roles--permissions)
11. [API Routes](#11-api-routes)
12. [Development Standards](#12-development-standards)
13. [Testing](#13-testing)
14. [Known Issues & Limitations](#14-known-issues--limitations)
15. [Roadmap](#15-roadmap)

---

## 1. CORE DEVELOPMENT PRINCIPLES

**These principles guide every decision and line of code.**

### 🎯 Ask, Don't Assume
- If something is unclear, **ask before writing a single line**
- Zero silent assumptions
- When requirements seem vague:
  - Request clarification from team/stakeholder
  - Document assumptions explicitly in comments/PRs
  - Confirm understanding before implementation
- *Better to spend 5 minutes asking than 2 hours fixing wrong code*

### 🏗️ Simplest Solution First
- Build the simplest thing that works
- No abstractions nobody asked for
- Guidelines:
  - Start with minimal viable implementation
  - Add complexity only when justified by requirements
  - Refactor after validation, not before
  - Mantra: "Make it work, make it right, make it fast" (in that order)

### 🚫 Don't Touch Unrelated Code
- If it's not part of the task, **don't modify it**
- Even if you think it needs fixing
- Rules:
  - One PR = One concern (feature/fix/refactor are separate)
  - Separate tasks for technical debt fixes
  - Report issues in code review, don't silently fix
  - Keep PRs focused and reviewable

### ⚠️ Flag Uncertainty
- If you're not confident, **say so before proceeding**
- Fake confidence breaks more code than honest doubt
- When uncertain:
  - Document the concern explicitly
  - Ask for a second opinion / design review
  - Never ship code you don't fully understand
  - Include uncertainty notes in commit messages

**Integration Points:**
- Code Review checklist includes verifying adherence to all 4 principles
- PR template asks authors to flag uncertainties
- Team standups discuss blocked/uncertain items

---

## 2. PROJECT OVERVIEW

### 2.1 What is BisnisMu?

**BisnisMu** adalah aplikasi akuntansi berbasis web yang dirancang khusus untuk:
- **UMKM** (Usaha Mikro, Kecil, Menengah)
- **Usaha rumahan / skala kecil**
- **BUMDes** (Badan Usaha Desa / Badan Usaha Daerah)

Aplikasi ini mengikuti **SAK EMKM** (Standar Akuntansi Keuangan Entitas Mikro, Kecil, Menengah — Indonesia), mudah digunakan tanpa latar belakang akuntansi formal, mendukung multi-usaha dalam satu akun, dan dibangun di atas stack modern yang aman dan cepat.

### 2.2 Key Differentiators

✅ **Jurnal otomatis yang benar secara akuntansi** — bukan hanya input transaksi sederhana  
✅ **Panduan kontekstual** untuk pengguna awam akuntansi  
✅ **Dukungan BUMDes** dengan format laporan sesuai Permendesa No. 4 Tahun 2015  
✅ **Offline-capable (PWA)** untuk daerah dengan koneksi terbatas  
✅ **Multi-usaha dalam satu akun** — kelola hingga 5+ bisnis sekaligus  

### 2.3 Target Users

| Persona | Profile | Needs |
|---------|---------|-------|
| **Ibu Sari** (Usaha Rumahan) | Pemilik warung makan, usia 35–50 | Catat pemasukan/pengeluaran harian, tahu untung/rugi |
| **Pak Budi** (UMKM Dagang) | Pemilik toko/distributor, usia 30–45 | Invoice, stok barang, laporan untuk bank/KUR |
| **Bendahara BUMDes** | Pengelola keuangan desa/koperasi | Laporan SAK EMKM, audit trail, transparansi |

---

## 3. TECHNOLOGY STACK

### 3.1 Backend & Core

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js + TypeScript (ESM) |
| **Framework** | Next.js 14+ (API Routes) |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Prisma 5+ |
| **Package Manager** | npm |

### 3.2 Frontend (Planned)

| Layer | Technology |
|-------|------------|
| **Framework** | React 18+ |
| **Styling** | Tailwind CSS + Glassmorphism |
| **Forms** | React Hook Form + Zod |
| **Data Fetching** | React Query (TanStack Query) |
| **UI Components** | Shadcn/ui |

### 3.3 Testing & Quality

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit tests |
| **TypeScript** | Type safety |
| **ESLint** | Code linting |

### 3.4 Infrastructure

| Tool | Purpose |
|------|---------|
| **GitHub** | Version control |
| **Neon** | PostgreSQL as a Service |
| **Vercel** | Deployment (planned) |

---

## 4. ARCHITECTURE & DESIGN

### 4.1 Architectural Pattern

BisnisMu follows **Hexagonal (Ports & Adapters) / Clean Architecture**:

```
Presentation Layer (API Routes)
        ↓
Application Services (Orchestration)
        ↓
Domain Engines (Pure business logic)
        ↓
Repositories (Persistence ports)
        ↓
Prisma Infrastructure (PostgreSQL)
```

### 4.2 Module Structure

Each feature module follows this pattern:

```
src/features/{module}/
├── domain/
│   ├── {module}.engine.ts       # Pure business logic, validations, calculations
│   └── {module}.types.ts         # Domain models & interfaces
├── application/
│   ├── {module}.service.ts       # Orchestration, calls domain + repositories
│   └── {module}.types.ts         # Application DTOs
├── infrastructure/
│   ├── prisma-{module}-repository.ts  # Prisma adapter
│   └── {module}.repository.ts    # Repository interface (port)
└── tests/
    ├── {module}.engine.test.ts
    └── {module}.service.test.ts
```

### 4.3 Service Composition

All services are composed in `src/presentation/api/server-services.ts`:

```typescript
export const serverServices = {
  journal: new JournalPostingService(...)
  business: new BusinessService(...)
  chartOfAccounts: new ChartOfAccountsService(...)
  cashManagement: new CashManagementService(...)
  arAp: new ArApService(...)
  sales: new SalesService(inventory, payment, ...)
  inventory: new InventoryService(...)
  revenue: new RevenueService(...)
  tourism: new TourismService(revenue, ...)
  pos: new PosService(sales, payment, cashSession, ...)
  // ... more services
}
```

### 4.4 Tenant Context & Security

Every operation carries a **TenantContext**:

```typescript
interface TenantContext {
  businessId: string
  actorUserId: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}
```

**Critical:** All services trust the caller to provide a valid context. Auth middleware (Phase 2) will validate this server-side.

### 4.5 Journal Posting Flow

```
Service receives draft transaction
    ↓
Domain engine previews journal entries
    ↓
JournalPostingService validates (accounting rules)
    ↓
pg_advisory_xact_lock serializes journal number per business
    ↓
Write journal_entries + journal_lines (atomic)
    ↓
Update source tables (inventory, AR/AP, etc.)
    ↓
Write audit log
    ↓
Return posted transaction reference
```

---

## 5. QUICK START

### 5.1 Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ (via Neon or local)
- Git

### 5.2 Setup Local Development

```bash
# 1. Clone repository
git clone <repo-url>
cd bisnismu

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and add your Neon PostgreSQL connection string:
# DATABASE_URL=postgresql://user:password@host/dbname?schema=public

# 4. Push schema to database
npm run prisma:migrate:dev

# 5. Generate Prisma Client
npx prisma generate

# 6. Start development server
npm run dev

# Server runs at http://localhost:3000
```

### 5.3 Available Scripts

```bash
npm test              # Run Vitest unit tests
npm run typecheck     # Run TypeScript compiler (no emit)
npm run dev           # Start Next.js dev server
npm run build         # Build for production
npm run prisma:migrate:dev   # Create & run migration locally
npm run prisma:migrate:deploy # Deploy migration to production database
npx prisma studio    # Open Prisma Studio (database GUI)
```

---

## 6. CORE MODULES

### 6.1 Complete Modules (Domain + Application + Prisma)

| Module | Purpose | Status |
|--------|---------|--------|
| **Accounting** | Journal posting, fiscal periods, audit logs | ✅ Production |
| **Business** | Multi-tenant isolation, fiscal period management | ✅ Production |
| **Chart of Accounts** | SAK EMKM account hierarchy, validation | ✅ Production |
| **Cash Management** | Cash in/out/transfer, reconciliation | ✅ Production |
| **Revenue** | Revenue categories, pricing, transaction posting | ✅ Production |
| **Tourism** | Tourism-specific revenue, tickets, visitor tracking | ✅ Production |
| **AR/AP** | Invoices, bills, payment allocation | ✅ Production |
| **Inventory** | Products, stock tracking, cost valuation | ✅ Production |
| **Float Management** | Cash float allocation & tracking | ✅ Production |
| **Reporting** | P&L, Balance Sheet, Trial Balance, GL | ✅ Production |

### 6.2 Partial Modules (Domain + Application, needs Prisma)

| Module | Purpose | Status | Notes |
|--------|---------|--------|-------|
| **Cash Sessions** | Cash drawer management, shift opening/closing | 🟡 WIP | Prisma schema needed |
| **Sales** | Sales orders, confirmations, payments | 🟡 WIP | Prisma schema needed |
| **Purchase** | ⚠️ Deprecated | See: Domain/App only | Merge into Inventory? |
| **Payment** | Payment wallet, allocations, receivables | 🟡 WIP | Prisma schema needed |
| **POS** | Point of sale, terminals, checkout | 🟡 WIP | Prisma schema needed |

### 6.3 Out of Scope (Phase 2+)

- Fixed Assets & Depreciation
- Tax Configuration (PPN/PPh)
- Bank Reconciliation
- Payroll
- Multi-currency
- Marketplace integrations
- AI Assistant

---

## 7. MULTI-UNIT ORGANIZATION

Fitur opsional di atas flat model — untuk BUMDes, koperasi, atau holding UMKM yang mengelola beberapa unit usaha sekaligus.

### 7.1 Dua Model Penggunaan

```
Model Flat (default — semua UMKM biasa):
  User → Business A
  User → Business B       ← sejajar, independen

Model Hierarki (opsional — BUMDes, koperasi):
  Organization (BUMDes Hanyukupi)
    ├── Business: Unit Simpan Pinjam
    ├── Business: Unit Perdagangan
    └── Business: Unit Pariwisata
```

### 7.2 Aturan Kritis — Wajib Diingat Saat Coding

- **Satu Business hanya bisa masuk ke SATU Organization** — FK biasa, bukan many-to-many. Jangan buat junction table.
- **`businessId` tetap jadi unit operasional** — semua service, repository, domain engine tidak berubah. Organization hanya layer di atas.
- **Tidak ada eliminasi transaksi antar unit** — laporan konsolidasi adalah agregasi/penjumlahan langsung. Tidak perlu interunit tagging.
- **Jangan sentuh kode existing** saat mengerjakan fitur ini — murni additive. Kalau ada yang terasa perlu diubah di kode lama, tanya dulu.

### 7.3 Tiga Mode Laporan

| Mode | Endpoint | Siapa yang pakai |
|------|----------|-----------------|
| Per unit | `/api/reports/*?businessId=X` | Kasir, bendahara per unit |
| Konsolidasi semua unit | `/api/organizations/:id/reports/profit-loss` | Direktur BUMDes |
| Perbandingan antar unit | `/api/organizations/:id/reports/unit-comparison` | Direktur, pengawas desa |

### 7.4 OrgRole & Cascade Permission

```
OrgRole.ORG_OWNER  →  otomatis ADMIN di semua Business unit-nya
OrgRole.ORG_ADMIN  →  otomatis ADMIN di semua Business unit-nya
OrgRole.ORG_VIEWER →  otomatis VIEWER di semua Business unit-nya

BusinessRole per unit tetap berlaku untuk akses spesifik per unit.
```

### 7.5 File yang Perlu Dibuat (Semua Baru)

```
src/features/organization/
├── domain/
│   ├── organization.types.ts          — OrgType, OrgRole, interfaces
│   └── organization.engine.ts         — Validasi, health score
├── application/
│   ├── organization.service.ts        — CRUD org + member management
│   ├── organization.repository.ts     — Repository port
│   └── consolidation.service.ts       — Laporan konsolidasi & perbandingan
└── infrastructure/
    └── prisma-organization-repository.ts

app/api/organizations/
├── route.ts                           — POST/GET /api/organizations
└── [orgId]/
    ├── route.ts
    ├── units/route.ts
    ├── members/[userId]/route.ts
    └── reports/
        ├── profit-loss/route.ts
        ├── balance-sheet/route.ts
        └── unit-comparison/route.ts
```

### 7.6 Registrasi di server-services.ts

Tambah di bagian paling bawah — **jangan ubah yang sudah ada**:

```typescript
export const orgServices = {
  organization: new OrganizationService(new PrismaOrganizationRepository()),
  consolidation: new ConsolidationService(
    new PrismaOrganizationRepository(),
    serverServices.reporting    // inject existing ReportingService
  ),
}
```

### 7.7 Prisma Migration

```bash
# Setelah tambah Organization, OrgMember, dan kolom organizationId di Business:
npx prisma migrate dev --name add_organization_layer
```

Kolom `organizationId` di `Business` adalah **nullable** — semua data existing tetap valid tanpa migration data.

### 7.8 Urutan Development

1. Prisma migration (1–2 jam)
2. Domain & Repository (2–3 jam)
3. OrganizationService (2–3 jam)
4. ConsolidationService (3–4 jam) — bagian terpenting, test dengan teliti
5. API Routes + Zod schemas (2–3 jam)
6. Tests (2–3 jam)

**Referensi lengkap:** `docs/PRD-BisnisMu-Addendum-MultiUnit-Organization.md`

---

## 8. DATABASE SCHEMA

### 8.1 Core Tables

**Accounting:**
- `journal_entries` — Posted journals with entries & reversal tracking
- `journal_lines` — Individual debit/credit lines

**Master Data:**
- `accounts` — Chart of accounts (SAK EMKM)
- `fiscal_periods` — Period state & closing
- `businesses` — Tenant definition

**Operational:**
- `cash_management_records` — Cash transactions
- `revenue_categories`, `revenue_items`, `revenue_transactions`
- `tourism_attractions`, `visitor_transactions`, `ticket_types`
- `ar_ap_invoices`, `ar_ap_bills`, `ar_ap_payments`
- `inventory_products`, `inventory_movements`, `inventory_balances`
- `audit_logs` — Immutable audit trail

### 8.2 Critical Schema Gaps (Not Yet Implemented)

⚠️ Missing for Phase 2 & beyond:
- `users`, `sessions`, `credentials` (auth)
- `business_members`, `business_roles` (RBAC)
- `platform_roles`, `god_mode_audit` (admin)
- `cash_drawers`, `cash_sessions`, `cash_movements`
- `sales_orders`, `sales_order_items`
- `purchase_orders`, `purchase_receipts`
- `pos_terminals`, `pos_sessions`, `pos_transactions`
- `payment_wallets`, `payment_allocations`

---

## 9. CURRENT SYSTEM STATUS

### 9.1 Status by Metric

| Metric | Score | Notes |
|--------|:-----:|-------|
| **Functional Completeness** | 97% | Core accounting 100%, export PDF/Excel ✅, onboarding ✅ |
| **Data Integrity** | 100% | Advisory locks + atomic ops |
| **Concurrency Safety** | 100% | Serialized journal numbers, atomic inventory |
| **Security Readiness** | 88% | Auth + RBAC + session revocation ✅. Missing: 2FA SUPER_ADMIN |
| **Production Readiness** | 93% | Missing: seed scripts, 2FA, Sentry DSN (setup ready) |

### 9.2 Latest Changes (v0.5.0 — 2026-06-03)

✅ **UI Compliance** — seluruh native elements (`<select>`, `<input>`, `<form>`, `<input type="date">`) diganti glass design system. `GlassDataSelect` baru, `GlassDatePicker`/`GlassDateTimePicker` jadi controlled components  
✅ **Export PDF + Excel** — 4 laporan × 2 format (jsPDF + xlsx). Tombol dropdown di setiap halaman laporan  
✅ **Onboarding flow** — register → `/onboarding` → buka fiscal period → dashboard. Register form tambah field jenis usaha  
✅ **Connection pooling** — Neon PgBouncer fix (`pgbouncer=true`, hapus `channel_binding`, tambah `DIRECT_URL`), Prisma schema `directUrl`  
✅ **Session revocation** — user logout semua perangkat, admin force logout. UI di Settings + Admin panel  
✅ **Error tracking** — Sentry opt-in setup (`sentry.*.config.ts`, `global-error.tsx`, conditional `withSentryConfig`)  
✅ **CI/CD** — `DIRECT_URL` di semua jobs, lint step, pre-deploy typecheck, migrations pakai direct connection  
✅ **Bug fix** — `GlassCalendar` header hari duplikat "Min" → "Min, Sen, Sel, Rab, Kam, Jum, Sab"  

### 9.3 Sebelumnya (v0.4.0 — 2026-06-03)

✅ **Authentication** — `better-auth` + Prisma adapter, email/password dengan argon2id hashing  
✅ **Session management** — cookie-based sessions (7-day expiry), `User` + `Session` + `AuthAccount` models  
✅ **Authorization middleware** — `middleware.ts` melindungi semua `/api/*` routes via session token  
✅ **RBAC enforcement** — `BusinessMember` + `BusinessMemberRole`, permission matrix lengkap per role  
✅ **Platform roles (God Mode)** — `PlatformRole` enum (SUPER_ADMIN, SUPPORT_AGENT, FINANCE_ADMIN, DEVELOPER), `/api/admin/*` terproteksi  
✅ **Rate limiting** — MemoryRateLimiter (dev) + UpstashRedis (prod), per-endpoint rules  
✅ **Security headers** — CSP, X-Frame-Options, HSTS, X-Content-Type-Options on semua responses  
✅ **Auth API routes** — `/api/auth/register`, `/api/auth/select-business`, `/api/auth/businesses`, `/api/auth/dev-login`, `/api/auth/bootstrap`  
✅ **businessId & actorUserId** sekarang diambil dari session server-side — tidak lagi dipercaya dari client  

### 9.3 Sebelumnya (v0.3.0 — 2026-06-01)

✅ **Revenue & Tourism routes** wired into DI + 17 new API endpoints  
✅ **RBAC enforcement** on revenue/tourism routes (OWNER, ADMIN, CASHIER)  
✅ **Zod validation** for all revenue/tourism payloads  
✅ **BigInt serialization** fixed globally  

See **CHANGELOG.md** for detailed history.

### 9.4 Remaining Critical Work

**Must-have before production:**
1. ❌ Seed scripts untuk demo/onboarding data
2. ❌ 2FA untuk SUPER_ADMIN (ada di PRD, deferred)

**Setup tinggal konfigurasi (sudah siap):**
3. ⚙️ Sentry — tinggal isi `SENTRY_DSN` di Vercel env vars
4. ⚙️ CI/CD secrets — tambah `DIRECT_URL`, `SENTRY_AUTH_TOKEN` di GitHub Secrets

---

## 10. ROLES & PERMISSIONS

### 10.1 Two-Tier Role System

```
┌──────────────────────────────────────────┐
│        PLATFORM LEVEL (God Mode)         │
│   SUPER_ADMIN  SUPPORT_AGENT  DEV  ...   │
└──────────────┬─────────────────────────────┘
               │
┌──────────────▼─────────────────────────────┐
│      BUSINESS LEVEL (per usaha)            │
│   OWNER  ADMIN  EDITOR  VIEWER  CASHIER   │
└────────────────────────────────────────────┘
```

**Key principle:** Platform role ≠ Business role. Both are independent.

### 10.2 Platform Roles (God Mode)

| Role | Access | Max | 2FA Required? |
|------|--------|-----|:-------------:|
| `SUPER_ADMIN` | Impersonate users, view all data, override limits | 5 | ✅ Yes |
| `SUPPORT_AGENT` | Read-only user/business data | N/A | ❌ No |
| `FINANCE_ADMIN` | Billing & subscription management | N/A | ❌ No |
| `DEVELOPER` | System logs, feature flags, API monitoring | N/A | ❌ No |
| `USER` | Default role (no admin access) | N/A | ❌ No |

### 10.3 Business Roles (per Usaha)

| Role | Can Create | Can Approve | Can Report | Can Config |
|------|:----------:|:-----------:|:----------:|:----------:|
| `OWNER` | ✅ | ✅ | ✅ | ✅ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ |
| `ACCOUNTANT` | ❌ | ❌ | ✅ | ❌ |
| `EDITOR` | ✅ | ❌ | ❌ | ❌ |
| `CASHIER` | ✅ (Kas only) | ❌ | ❌ | ❌ |
| `VIEWER` | ❌ | ❌ | ✅ | ❌ |

**See:** PRD-BisnisMu-Addendum-Roles-GodMode.md for full permission matrix.

---

## 11. API ROUTES

### 11.1 Current API Endpoints

#### Business & Accounting
```
POST   /api/business/create
GET    /api/business/{businessId}
POST   /api/fiscal-periods
POST   /api/journal/post
POST   /api/accounts/seed-chart
```

#### Revenue
```
POST   /api/revenue/categories
GET    /api/revenue/categories
POST   /api/revenue/items
POST   /api/revenue/transactions
POST   /api/revenue/transactions/post
POST   /api/revenue/transactions/void
```

#### Tourism
```
POST   /api/tourism/attractions
POST   /api/tourism/visitor-transactions
POST   /api/tourism/tickets/validate
```

#### AR/AP
```
POST   /api/ar-ap/invoices/post
POST   /api/ar-ap/bills/post
POST   /api/ar-ap/payments
```

#### Cash & POS
```
POST   /api/cash/transactions/post
POST   /api/cash/transactions/void
POST   /api/pos/terminals
POST   /api/pos/sessions/close
POST   /api/pos/cart
POST   /api/pos/checkout
```

#### Inventory
```
POST   /api/inventory/products
POST   /api/inventory/stock-in
```

#### Reporting
```
GET    /api/reports/profit-loss
GET    /api/reports/balance-sheet
GET    /api/reports/trial-balance
GET    /api/dashboard/overview
```

### 11.2 Input Validation

All routes validate requests using:
- **Zod schemas** in `src/presentation/api/request-schemas.ts`
- **TenantContext** extracted from session (future: auth middleware)
- **Role-based route guards** in `ROUTE_PERMISSION_RULES`

Example:

```typescript
// Route handler
export async function POST(req: Request) {
  const body = await req.json()
  
  // Validate & extract context
  const validated = await validatedBody(PostRevenueTransactionSchema, body)
  const { businessId, actorUserId } = validated
  
  // Call service (context is assured valid)
  const result = await serverServices.revenue.postTransaction(
    { businessId, actorUserId },
    payload
  )
  
  return serializeResponse(result)
}
```

---

## 12. DEVELOPMENT STANDARDS

### 12.1 Naming Conventions

**Files & Directories:**
```
domain/       — *.engine.ts, *.types.ts
application/  — *.service.ts, *.types.ts
infrastructure/ — prisma-*.repository.ts
tests/        — *.test.ts (co-located with source)
api/          — route.ts or [id]/route.ts
```

**Variables & Functions:**
```typescript
// Services (verb-noun pattern)
postJournal(), createInvoice(), allocatePayment()

// Repositories (generic CRUD + domain-specific)
save(), findById(), findByBusinessId(), updateStatus()

// Enums (UPPER_SNAKE_CASE)
TransactionStatus.DRAFT, AccountGroup.ASSET

// Interfaces (IPascalCase for ports, PascalCase for models)
IRevenueRepository, JournalLine, TenantContext
```

### 12.2 Code Style

**TypeScript:**
- Strict mode enabled (`strict: true` in tsconfig.json)
- No implicit `any`
- Explicit return types on all functions
- Zod for runtime validation

**Imports:**
```typescript
// Order: external → relative domain → relative app → relative infra
import { z } from 'zod'
import { RevenueEngine } from './domain/revenue.engine'
import type { RevenueService } from './application/revenue.service'
import { PrismaRevenueRepository } from './infrastructure/prisma-revenue-repository'
```

**Comments:**
```typescript
// ✅ DO: Explain WHY not WHAT
// We use advisory_xact_lock to serialize journal number generation
// because race conditions would create duplicate journal IDs across
// concurrent requests in multi-usaha scenarios.

// ❌ DON'T: State the obvious
// Increment the counter
counter++
```

### 12.3 Testing Patterns

**Unit Tests:**
```typescript
describe('RevenueEngine', () => {
  it('should calculate tax correctly for tiered pricing', () => {
    const engine = new RevenueEngine()
    const result = engine.calculateRevenue(...)
    expect(result.tax).toBe(...)
  })
})
```

**Min Coverage:** 80% (domain/application layers)

### 12.4 Commit Message Format

```
type(scope): brief description

Optional body explaining WHY (not WHAT).

Closes #123
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Examples:**
```
feat(revenue): add tier-based pricing calculation
fix(journal): serialize journal number with advisory lock
refactor(inventory): extract atomic stock operations to SQL
```

### 12.5 UI Component Rules

#### ❌ Dilarang — Jangan Pernah Pakai Elemen Browser Native

Browser native elements **tidak boleh digunakan langsung** di manapun dalam codebase — baik di halaman, form, modal, maupun komponen kecil sekalipun. Alasannya: tampilan berbeda di setiap browser/OS, tidak bisa dikustomisasi sesuai desain glassmorphism yang digunakan, dan merusak konsistensi UX.

| Yang dilarang | Gantinya dengan |
|--------------|----------------|
| `<form>` | Layout `<div>` + React Hook Form (`useForm`) |
| `<input type="text/number/email/password">` | `<Input>` dari shadcn/ui |
| `<select>` | `<Select>` dari shadcn/ui |
| `<input type="checkbox">` | `<Checkbox>` dari shadcn/ui |
| `<input type="radio">` | `<RadioGroup>` dari shadcn/ui |
| `<input type="date">` / `<input type="datetime-local">` | `<DatePicker>` custom (shadcn/ui Calendar + Popover) |
| `<input type="file">` | `<FileUpload>` custom component |
| `<textarea>` | `<Textarea>` dari shadcn/ui |
| `alert()` / `confirm()` / `prompt()` | `<AlertDialog>` dari shadcn/ui |
| `<dialog>` / `<details>` | `<Dialog>` / `<Accordion>` dari shadcn/ui |
| Browser tooltip default | `<Tooltip>` dari shadcn/ui |
| Browser context menu | `<DropdownMenu>` dari shadcn/ui |
| `window.open()` untuk notifikasi | `<Toast>` / `<Sonner>` |

#### ✅ Wajib — Selalu Pakai Komponen dari Design System

Semua komponen UI **wajib** berasal dari salah satu sumber berikut, dengan urutan prioritas:

1. **shadcn/ui** — komponen utama (sudah dikonfigurasi di project)
2. **Custom component** di `src/components/ui/` — jika shadcn tidak tersedia atau perlu ekstensi
3. **Tidak ada opsi ketiga** — jangan install library UI lain tanpa diskusi tim

```
src/components/
├── ui/                  ← shadcn/ui components (generate via CLI)
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── date-picker.tsx  ← custom wrapper atas shadcn Calendar
│   └── ...
├── forms/               ← form compositions pakai React Hook Form
│   ├── transaction-form.tsx
│   └── ...
└── shared/              ← komponen bisnis yang dipakai di banyak tempat
```

#### Contoh Benar vs Salah

```tsx
// ❌ SALAH — jangan pernah
<form onSubmit={handleSubmit}>
  <input type="text" value={name} onChange={e => setName(e.target.value)} />
  <select value={type} onChange={e => setType(e.target.value)}>
    <option value="kas">Kas</option>
  </select>
  <input type="date" value={date} />
</form>

// ✅ BENAR — selalu begini
const form = useForm<TransactionForm>({ resolver: zodResolver(schema) })

<div className="space-y-4">
  <FormField control={form.control} name="name" render={({ field }) => (
    <FormItem>
      <FormLabel>Nama Transaksi</FormLabel>
      <FormControl><Input placeholder="Masukkan nama..." {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )} />

  <FormField control={form.control} name="type" render={({ field }) => (
    <FormItem>
      <FormLabel>Tipe</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <SelectTrigger><SelectValue placeholder="Pilih tipe..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="kas">Kas</SelectItem>
        </SelectContent>
      </Select>
    </FormItem>
  )} />

  <FormField control={form.control} name="date" render={({ field }) => (
    <FormItem>
      <FormLabel>Tanggal</FormLabel>
      <DatePicker value={field.value} onChange={field.onChange} />
    </FormItem>
  )} />
</div>
```

#### Notifikasi & Feedback — Tidak Ada Browser Alert

```tsx
// ❌ SALAH
alert('Transaksi berhasil disimpan')
confirm('Yakin ingin menghapus?')

// ✅ BENAR — gunakan toast untuk notifikasi non-destruktif
toast.success('Transaksi berhasil disimpan')
toast.error('Gagal menyimpan transaksi')

// ✅ BENAR — gunakan AlertDialog untuk konfirmasi destruktif
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Hapus</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Yakin ingin menghapus?</AlertDialogTitle>
      <AlertDialogDescription>Aksi ini tidak bisa dibatalkan.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Batal</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### Checklist PR — Komponen UI

Setiap PR yang menyentuh frontend **wajib** reviewer cek:
- [ ] Tidak ada `<form>`, `<input>`, `<select>`, `<textarea>` bare
- [ ] Tidak ada `alert()`, `confirm()`, `prompt()`
- [ ] Tidak ada `<input type="date">` atau datetime picker native
- [ ] Semua feedback pakai `<Toast>` / `<AlertDialog>`
- [ ] Semua komponen berasal dari `src/components/ui/` atau shadcn/ui

### 12.6 PR Guidelines

✅ **DO:**
- One feature/fix/refactor per PR
- Clear title & description
- Link related issues
- Self-review before requesting
- Flag any uncertainties

❌ **DON'T:**
- Mix unrelated changes
- "Fix: cleanup code" without context
- Approve your own PR
- Merge without review
- Bypass the 4 core principles

---

## 13. TESTING

### 13.1 Test Structure

```
src/features/
├── {module}/
│   ├── domain/
│   │   └── {module}.engine.test.ts      (pure logic)
│   ├── application/
│   │   └── {module}.service.test.ts    (orchestration + mocks)
│   └── infrastructure/
│       └── {module}.repository.test.ts (integration with Prisma)
```

### 13.2 Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
npm test -- {pattern}       # Run specific test file
```

### 13.3 Test Pyramid

```
Unit Tests (70%)           — domain engines, pure functions
Integration Tests (25%)    — service + repository mocks
E2E Tests (5%)            — full flow against test DB
```

### 13.4 Example Test

```typescript
describe('JournalPostingService', () => {
  let service: JournalPostingService
  let journalRepo: MockJournalRepository
  
  beforeEach(() => {
    journalRepo = new MockJournalRepository()
    service = new JournalPostingService(journalRepo, accountingEngine)
  })

  it('should post a balanced journal with audit trail', async () => {
    const journal = {
      lines: [
        { accountCode: '1101', debit: 1000000n, credit: 0n },
        { accountCode: '4001', debit: 0n, credit: 1000000n }
      ]
    }
    
    const result = await service.post(tenantContext, journal)
    
    expect(result.status).toBe('POSTED')
    expect(journalRepo.lastSavedJournal).toBeDefined()
  })
})
```

---

## 14. KNOWN ISSUES & LIMITATIONS

### 14.1 Resolved Issues (Previously Blockers)

✅ **Authentication** — Sekarang menggunakan `better-auth` dengan Prisma adapter. User, Session, AuthAccount tersimpan di DB. Password di-hash dengan argon2id.

✅ **Authorization** — Middleware melindungi semua `/api/*`. `businessId` dan `actorUserId` diambil dari session server-side. BusinessMember + permission guard aktif.

### 14.2 Known Limitations

⚠️ **Tenant isolation is caller-enforced only**
- No database-level row security
- Depends entirely on correct context being passed

⚠️ **Transactions are not atomic across all writes**
- Journal posting + domain record update + audit log should be one transaction
- Currently: 3 separate writes (race condition risk)
- **Workaround:** Use advisory lock for journal, transaction for others

⚠️ **Reversal strategy is inconsistent**
- Some flows post reversing journals
- Some mark records as VOID
- No unified reversal policy
- **Fix:** Define canonical reversal approach

⚠️ **Period-end closing is not implemented**
- Reporting includes current-period earnings (no retained earnings transfer)
- No period locks to prevent retroactive edits

⚠️ **BigInt serialization requires custom middleware**
- PostgreSQL bigint → JSON is lossy by default
- Relies on global `serializeResponse()` wrapper
- **Risk:** Forgetting to wrap an endpoint breaks serialization

### 14.3 Workarounds & Mitigations

For now (until Phase 2 fixes these):

```typescript
// ✅ Always wrap JSON responses
return serializeResponse(result)  // Handles BigInt & Date serialization

// ✅ Always pass TenantContext from request
const { businessId, actorUserId } = await validatedBody(schema, body)
// DON'T trust these from client in production!

// ✅ Test journal posting with concurrent requests
// Use advisory lock to serialize number generation
```

---

## 15. ROADMAP

### Phase 1: Core Accounting Backend ✅ (Complete)
- ✅ Prisma setup & migrations
- ✅ Service composition & DI
- ✅ Journal posting with concurrency control
- ✅ All major modules wired

### Phase 2: Identity & Permissions ✅ (Complete — 2026-06-03)
- ✅ User management & authentication (`better-auth` + argon2id)
- ✅ Session management (cookie-based, 7-day expiry)
- ✅ BusinessMember & RBAC enforcement (middleware + permission matrix)
- ✅ God Mode / Platform roles (SUPER_ADMIN, SUPPORT_AGENT, FINANCE_ADMIN, DEVELOPER)
- ✅ Rate limiting (Memory dev / Upstash Redis prod)
- ✅ Security headers (CSP, HSTS, X-Frame-Options, dll)
- ✅ Session revocation (user all-devices + admin force logout)
- ❌ 2FA untuk SUPER_ADMIN (deferred)

### Phase 3: Frontend & UX ✅ (Complete — 2026-06-03)
- ✅ 59 halaman frontend dengan glass design system
- ✅ UI compliance — zero native form elements di semua halaman
- ✅ `GlassDataSelect`, `GlassDatePicker`/`GlassDateTimePicker` (controlled)
- ✅ Export PDF + Excel (4 laporan × 2 format)
- ✅ Onboarding flow (register → fiscal period → dashboard)
- ✅ Error boundary global (`app/global-error.tsx`)

### Phase 7: Production Hardening (Partially Done)
- ✅ CI/CD — GitHub Actions (ci.yml + deploy.yml) dengan typecheck, lint, migrate, deploy
- ✅ Connection pooling — Neon PgBouncer (`pgbouncer=true`, `DIRECT_URL`)
- ✅ Sentry setup — opt-in, tinggal konfigurasi DSN
- ❌ Seed scripts / demo data
- ❌ 2FA SUPER_ADMIN
- ❌ Docker development setup

### Phase 3: API Exposure & Frontend (Planned)
- ❌ Frontend React components
- ❌ OpenAPI documentation
- ❌ Request validation at HTTP layer
- ❌ Error handling & response formatting
- ⏳ **Target:** Q3 2026

### Phase 4: Persistence for Advanced Modules (Planned)
- ❌ Cash drawers & sessions
- ❌ Sales orders & confirmations
- ❌ Purchase orders & receipts
- ❌ Payment wallets & allocations
- ❌ POS integration
- ⏳ **Target:** Q4 2026

### Phase 5: User-Facing Workflows (Planned)
- ❌ Onboarding flow
- ❌ Transaction entry screens
- ❌ Report screens & export
- ❌ Dashboard & summaries
- ⏳ **Target:** Q4 2026

### Phase 6: Advanced Features (Post-MVP)
- ❌ Fixed assets & depreciation
- ❌ Tax configuration (PPN/PPh)
- ❌ Bank reconciliation
- ❌ Notifications & reminders
- ❌ BUMDes report formats
- ⏳ **Target:** 2027

### Phase 7: Production Hardening (Ongoing)
- ❌ CI/CD pipeline
- ❌ Docker setup
- ❌ Observability & error tracking
- ❌ Load testing & optimization
- ❌ Security audit

---

## 📚 APPENDIX

### A. Key Files to Know

```
src/
├── features/          — All business modules
├── presentation/
│   ├── api/
│   │   ├── server-services.ts     ← Service composition & DI
│   │   ├── route-handler.ts       ← Global response serializer
│   │   └── request-schemas.ts     ← Zod validation schemas
│   └── modules/
└── lib/               — Utilities

prisma/
├── schema.prisma      ← Database schema (source of truth)
└── migrations/        ← Prisma migration files

tests/
├── {module}.test.ts   ← Unit tests
└── setup.ts           ← Test utilities

.env.example           — Template for environment variables
```

### B. Useful Commands

```bash
# Development
npm run dev                          # Start dev server
npm test                             # Run tests
npm run typecheck                    # Check types

# Database
npx prisma studio                    # Open Prisma Studio GUI
npm run prisma:migrate:dev           # Create migration locally
npm run prisma:migrate:deploy        # Deploy migration to prod
npx prisma db seed                   # Run seed script (when implemented)

# Production
npm run build                        # Build Next.js
npm run start                        # Run production server

# Code Quality
npm run lint                         # Run ESLint
npm run format                       # Format with Prettier
```

### C. Important Principles to Remember

1. **Always ask before assuming** — unclear requirements cost more than 5 minutes of clarification
2. **Ship the simplest solution** — premature abstraction is the root of all evil
3. **Keep PRs focused** — one concern per PR makes reviews faster and rollbacks safer
4. **Flag uncertainty upfront** — "I'm not sure about X" saves debugging hours later

### D. References

- **Product Requirements:** [PRD-BisnisMu-v1_0.md](./docs/PRD-BisnisMu-v1_0.md)
- **Roles & Permissions:** [PRD-BisnisMu-Addendum-Roles-GodMode.md](./docs/PRD-BisnisMu-Addendum-Roles-GodMode.md)
- **Multi-Unit Organization:** [PRD-BisnisMu-Addendum-MultiUnit-Organization.md](./docs/PRD-BisnisMu-Addendum-MultiUnit-Organization.md)
- **Architecture Details:** [Architecture.md](./docs/Architecture.md)
- **Implementation History:** [HANDOFF.md](./docs/HANDOFF.md)
- **Change Log:** [CHANGELOG.md](./CHANGELOG.md)

---

**Last Updated:** June 3, 2026  
**Maintained By:** Development Team  
**Status:** Active Development (Pre-Production)

