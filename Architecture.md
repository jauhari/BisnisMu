# AkuntansiMu Architecture

Date reviewed: 2026-05-31  
Scope reviewed: `src/features`, `prisma/schema.prisma`, `tests`, `docs`

## Executive Summary

AkuntansiMu is currently a TypeScript domain and application service codebase for a multi-business accounting product. The repository is organized around feature modules with a common pattern:

1. `domain`: pure business/accounting rules, validation, calculations, and journal previews.
2. `application`: orchestration services and repository ports.
3. `infrastructure`: Prisma-backed repository adapters where implemented.
4. `tests`: Vitest unit tests for domain and service behavior.

The core accounting foundation is present: chart of accounts, fiscal periods, double-entry journal posting, cash transactions, revenue, AR/AP, inventory, tourism revenue, float management, and reporting. Some later-stage modules exist at the domain/application level only and are not yet backed by Prisma schema or infrastructure.

## Technology Stack

- Runtime/language: Node.js with TypeScript ESM.
- ORM/database: Prisma Client targeting PostgreSQL.
- Validation/calculation helpers: TypeScript domain engines plus `zod` dependency.
- Tests: Vitest.
- Package manager: npm.

Repository scripts:

- `npm test`: run Vitest.
- `npm run typecheck`: run TypeScript compiler without emitting files.

There is no frontend, HTTP/API layer, auth layer, migration folder, deployment configuration, or app entrypoint in the current repository.

## Architectural Pattern

The code follows a hexagonal/clean architecture style:

- Domain engines know accounting rules but do not perform persistence.
- Application services build tenant context, fetch state through repository interfaces, call domain engines, post journals, update module records, and write audit logs.
- Infrastructure repositories implement selected repository interfaces using Prisma.
- Journal posting is centralized through `JournalPostingService`, which validates journals using `AccountingEngine`, writes journal entries/lines, and audits accepted or rejected postings.

The central dependency direction is:

```text
Feature Service
  -> Feature Repository Port
  -> Feature Domain Engine
  -> JournalPostingService
      -> AccountingEngine
      -> JournalRepository Port
          -> PrismaJournalRepository
```

All business operations carry a tenant context containing at least `businessId` and `actorUserId`, with optional `requestId`, `ipAddress`, and `userAgent` metadata for auditability.

## Existing Modules

### Accounting

Files:

- `src/features/accounting/domain`
- `src/features/accounting/application`
- `src/features/accounting/infrastructure`

Responsibilities:

- Validate journal posting inputs.
- Enforce tenant scope, open fiscal period, active/postable accounts, normal balances, positive line amounts, debit/credit presence, and balanced totals.
- Support idempotent posting through `idempotencyKey`.
- Persist posted journals and journal lines through Prisma.
- Audit both posted and rejected journal attempts.

Key models:

- `JournalEntry`
- `JournalLine`
- `FiscalPeriod`
- `Account`
- `AuditLog`

### Business

Files:

- `src/features/business/domain`
- `src/features/business/application`
- `src/features/business/infrastructure`

Responsibilities:

- Create and update businesses.
- Manage fiscal periods.
- Close and reopen periods with validation.
- Save and post beginning balances.
- Build fiscal-year date ranges from configurable fiscal year start month.

Accounting integration:

- Beginning balances are validated for debit/credit equality.
- Posted beginning balances create a journal through `JournalPostingService`.

### Chart of Accounts

Files:

- `src/features/chart-of-accounts/domain`
- `src/features/chart-of-accounts/application`
- `src/features/chart-of-accounts/infrastructure`

Responsibilities:

- Manage SAK EMKM-style accounts.
- Seed a chart of accounts template.
- Validate account code format and group alignment.
- Enforce expected normal balance by group.
- Validate parent-child account hierarchy.
- Prevent deletion/deactivation of system accounts.
- Deactivate non-system accounts that already have journal lines instead of deleting them.

Account group mapping used in code:

- `1`: Asset, normal debit.
- `2`: Liability, normal credit.
- `3`: Equity, normal credit.
- `4`: Revenue, normal credit.
- `5`: COGS, normal debit.
- `6`: Expense, normal debit.
- `7`: Other expense, normal debit.

### Cash Management

Files:

- `src/features/cash-management/domain`
- `src/features/cash-management/application`
- `src/features/cash-management/infrastructure`

Responsibilities:

- Manage contacts.
- Preview cash journal impact.
- Create and update draft cash transactions.
- Post cash transactions.
- Void posted cash transactions.

Supported transaction types:

- `CASH_IN`
- `CASH_OUT`
- `TRANSFER`

Accounting flows:

- Cash in: debit cash/bank, credit category account.
- Cash out: debit category account, credit cash/bank.
- Transfer: debit destination cash/bank, credit source cash/bank.
- Void: reverse the original transaction lines.

### Cash Sessions

Files:

- `src/features/cash/domain`
- `src/features/cash/application`

Responsibilities:

- Cash drawers and shift/session lifecycle.
- Opening balance journal preview and posting.
- Cash movement posting.
- Transfer between cash accounts.
- Closing session and difference handling.
- Cash reconciliation.

Status:

- Domain and application services exist.
- No Prisma infrastructure exists.
- No database models for cash drawers, cash sessions, cash movements, or cash reconciliations exist in `schema.prisma`.

### Revenue

Files:

- `src/features/revenue/domain`
- `src/features/revenue/application`
- `src/features/revenue/infrastructure`

Responsibilities:

- Manage revenue categories, items, packages, and pricing.
- Preview revenue transaction journals.
- Create draft revenue transactions.
- Post revenue transactions.
- Void posted revenue transactions.

Accounting flows:

- Revenue posting: debit cash/bank, credit revenue account.
- Revenue void: reverse revenue and cash/bank lines.

Pricing supports standard, tier, daily, weekend, seasonal, and package-style pricing.

### Tourism

Files:

- `src/features/tourism/domain`
- `src/features/tourism/application`
- `src/features/tourism/infrastructure`

Responsibilities:

- Manage attractions.
- Manage ticket types, ticket packages, parking services, rental services, and tenant rentals.
- Price visitor transactions based on source and configured prices.
- Generate validation code, receipt number, and QR payload.
- Create visitor transactions and post matching revenue transactions.
- Validate tickets.
- Void paid visitor transactions through revenue voiding.

Business flows:

- Tourism sale is priced by `TourismEngine`.
- `TourismService` creates a visitor transaction.
- `RevenueService` creates and posts the matching revenue transaction.
- Visitor transaction is marked paid with the revenue transaction reference.

### AR/AP

Files:

- `src/features/ar-ap/domain`
- `src/features/ar-ap/application`
- `src/features/ar-ap/infrastructure`

Responsibilities:

- Manage customers and vendors.
- Create and post invoices.
- Create and post vendor bills.
- Record customer and vendor payments.
- Apply credit notes to invoices.
- Generate receivable and payable aging buckets.

Accounting flows:

- Invoice: debit accounts receivable, credit revenue.
- Customer payment: debit cash/bank, credit accounts receivable.
- Credit note: debit revenue, credit accounts receivable.
- Bill: debit expense, credit accounts payable.
- Vendor payment: debit accounts payable, credit cash/bank.

### Float Management

Files:

- `src/features/float/domain`
- `src/features/float/application`
- `src/features/float/infrastructure`

Responsibilities:

- Manage prepaid provider float accounts.
- Top up float.
- Consume float.
- Transfer float between provider accounts.
- Adjust float balances.
- Snapshot balances.

Accounting flows:

- Top up: debit float asset, credit cash/bank.
- Consumption: debit configured offset/expense, credit float asset.
- Transfer: debit destination float asset, credit source float asset.
- Adjustment: increase or decrease float against an adjustment account.

### Inventory

Files:

- `src/features/inventory/domain`
- `src/features/inventory/application`
- `src/features/inventory/infrastructure`

Responsibilities:

- Manage product categories and products.
- Manage product buy/sell prices.
- Track inventory balances by product and warehouse/location.
- Record stock in, stock out, adjustment, transfer, and digital product consumption.
- Maintain average cost and product cost history.
- Integrate digital products with float consumption when a `FloatManagementService` is supplied.

Accounting flows:

- Stock in: debit inventory, credit offset account.
- Stock out: debit COGS/expense, credit inventory.
- Adjustment: debit or credit inventory against adjustment account depending on direction.
- Digital consumption: consume provider float and record digital product movement.

### Sales

Files:

- `src/features/sales/domain`
- `src/features/sales/application`

Responsibilities:

- Build sales orders from product/service lines.
- Confirm sales orders.
- Allocate payments to sales.
- Coordinate inventory and payment services.

Accounting flows:

- Confirmed sale posts revenue by debiting settlement account or AR and crediting product revenue.
- Inventory/COGS impact is delegated to inventory flows for stock-tracked products.
- Payment allocation is delegated to payment flows.

Status:

- Domain and application services exist.
- No Prisma infrastructure exists.
- No sales order database models exist in `schema.prisma`.

### Purchase

Files:

- `src/features/purchase/domain`
- `src/features/purchase/application`

Responsibilities:

- Create and approve purchase orders.
- Receive purchase orders.
- Create purchase returns.
- Generate vendor bills.
- Coordinate inventory and optional AR/AP bill generation.

Accounting flows:

- Purchase receipt: debit inventory, credit GRNI.
- Vendor bill from purchase: debit GRNI, credit accounts payable.
- Purchase return: debit AP/clearing, credit inventory.

Status:

- Domain and application services exist.
- No Prisma infrastructure exists.
- No purchase order, receipt, or return database models exist in `schema.prisma`.

### Payment

Files:

- `src/features/payment/domain`
- `src/features/payment/application`

Responsibilities:

- Customer wallets/deposits.
- Wallet top up, spend, refund, and adjustment.
- Create payment transactions.
- Allocate payments to receivables.
- Settle receivables.

Accounting flows:

- Wallet top up: debit cash/bank, credit wallet liability.
- Wallet spend: debit wallet liability, credit settlement/revenue target.
- Wallet refund: debit wallet liability, credit cash/bank.
- Receivable settlement: debit cash/bank, credit receivable.

Status:

- Domain and application services exist.
- No Prisma infrastructure exists.
- No wallet, payment transaction, payment allocation, or receivable database models exist in `schema.prisma`.
- This is separate from the simpler AR/AP `Payment` model currently in Prisma.

### POS

Files:

- `src/features/pos/domain`
- `src/features/pos/application`

Responsibilities:

- POS terminal and session lifecycle.
- Cart item add/remove.
- Checkout into a sales order.
- Allocate POS payments.
- Save change as customer deposit.
- Void POS transactions.
- Coordinate cash, sales, and payment services.

Accounting flows:

- Opening/closing session delegates to cash session flows if the terminal has a cash drawer.
- Checkout delegates to sales confirmation.
- Payment delegates to sales/payment allocation.
- Change saved as deposit delegates to wallet top-up.

Status:

- Domain and application services exist.
- No Prisma infrastructure exists.
- No POS terminal, POS session, POS transaction, cart item, or receipt database models exist in `schema.prisma`.

### Reporting

Files:

- `src/features/reporting/domain`
- `src/features/reporting/application`
- `src/features/reporting/infrastructure`

Responsibilities:

- Generate general ledger.
- Generate trial balance.
- Generate income statement.
- Generate balance sheet.
- Audit report generation.

Accounting behavior:

- General ledger calculates opening and running balances by normal balance.
- Trial balance validates debit total equals credit total.
- Income statement groups revenue, COGS, expenses, and other expenses.
- Balance sheet groups assets, liabilities, and equity, then adds current-period earnings to equity.

## Business Flows

### Business Onboarding

1. Create business with name, type, fiscal year start, and IDR currency.
2. Seed SAK EMKM chart of accounts.
3. Open fiscal period.
4. Save beginning balances.
5. Post beginning balances to the journal.

Current coverage:

- Business, fiscal period, beginning balance, and chart of accounts services exist.
- User identity and membership enforcement are not implemented; services rely on incoming `actorUserId`.

### Cash Transaction Flow

1. User creates a contact if needed.
2. User previews cash journal lines.
3. User creates a draft cash transaction.
4. User updates draft if needed.
5. User posts the draft.
6. Service posts a journal through `JournalPostingService`.
7. Cash transaction is marked `POSTED`.
8. Audit log records the action.
9. Posted transaction can be voided, which posts a reversing journal and marks the transaction `VOID`.

### Revenue Flow

1. Configure revenue category with a revenue account.
2. Configure item/package and pricing.
3. Preview or create revenue draft.
4. Post draft to journal.
5. Mark transaction `POSTED`.
6. Void by creating a reversing journal and marking `VOID`.

### Tourism Visitor Flow

1. Configure attraction.
2. Configure ticket, package, parking, rental, or tenant rental.
3. Create visitor transaction.
4. Tourism pricing computes source-specific unit price and total amount.
5. Visitor transaction gets validation code, receipt number, and QR payload.
6. Revenue transaction is created and posted.
7. Visitor transaction is marked `PAID`.
8. Ticket validation reads the validation code and returns paid/not-paid status.
9. Void delegates to revenue voiding, then marks visitor transaction `VOID`.

### AR/AP Flow

1. Create customer/vendor.
2. Draft invoice or bill.
3. Post invoice/bill to journal.
4. Record payment against invoice or bill.
5. Update document paid amount and status.
6. Generate aging reports from outstanding documents.

### Inventory Flow

1. Create product category and product.
2. Set buy/sell price.
3. Stock in, stock out, adjustment, transfer, or digital consumption.
4. Inventory engine updates quantity, average cost, and inventory value.
5. Journal is posted for accounting impact.
6. Inventory movement and cost history are persisted.

### POS Flow

1. Open POS session, optionally opening a linked cash session.
2. Add products to cart.
3. Checkout cart into sales order.
4. Confirm sale and post accounting.
5. Allocate tender/payment.
6. Create receipt when paid.
7. Save excess change as deposit when selected.
8. Close POS session and linked cash session.

Current coverage:

- Domain/application logic exists.
- Persistence models and repository implementation are missing.

## Accounting Flows

### Journal Posting Invariants

Every posted journal must satisfy:

- `businessId` is present.
- Fiscal period belongs to the same business.
- Fiscal period is open.
- Transaction date falls inside the fiscal period.
- Every account belongs to the same business.
- Every account is active and posting-enabled.
- Account normal balance matches its account group.
- At least two lines exist.
- At least one debit and one credit exist.
- Every line amount is positive.
- Total debit equals total credit.

### Idempotency

Most services construct deterministic idempotency keys, for example:

- `cash:{businessId}:{transactionId}`
- `void-cash:{businessId}:{transactionId}`
- `revenue:{businessId}:{transactionId}`
- `void-revenue:{businessId}:{transactionId}`
- module-specific keys for cash sessions, inventory, sales, and purchase flows.

The accounting repository has a unique `(businessId, idempotencyKey)` constraint on `JournalEntry`.

### Audit Trail

Most implemented services write audit events after material actions. Accounting writes audit logs for both successful and rejected journal attempts. The current audit model is tenant-scoped through `businessId`.

Notable limitation:

- Platform-level or user-level audit events without a business are not supported by the current `AuditLog` schema because `businessId` is required.

## Database Schema

The Prisma schema defines PostgreSQL models using `BigInt` for money amounts. Amounts appear to be stored in minor currency units for IDR.

### Core Tenant and Accounting Tables

- `businesses`: tenant/business records, type, status, fiscal-year settings, currency, creator.
- `accounts`: chart of accounts, hierarchy, group, subtype, normal balance, posting flags.
- `fiscal_periods`: fiscal year windows and close/reopen metadata.
- `beginning_balances`: per-account beginning balance lines by fiscal period.
- `journal_entries`: posted/reversed journals, source metadata, totals, idempotency.
- `journal_lines`: debit/credit lines tied to accounts and journals.
- `audit_logs`: tenant-scoped audit records.

### Cash and Contacts

- `contacts`: generic customer/supplier/other contact records for cash transactions.
- `cash_transactions`: draft/posted/void cash in/out/transfer transactions.

### Revenue and Tourism

- `revenue_categories`
- `revenue_items`
- `revenue_packages`
- `revenue_pricings`
- `revenue_transactions`
- `attractions`
- `ticket_types`
- `ticket_packages`
- `parking_services`
- `rental_services`
- `tenant_rentals`
- `visitor_transactions`

### AR/AP

- `customers`
- `vendors`
- `invoices`
- `bills`
- `payments`
- `adjustment_notes`

### Float

- `float_accounts`
- `float_transactions`
- `float_balance_snapshots`

### Inventory and Products

- `product_categories`
- `products`
- `product_prices`
- `inventory_balances`
- `inventory_movements`
- `product_cost_histories`
- `provider_products`

### Important Schema Gaps

The current schema does not include tables for:

- Users, authentication, sessions, password credentials, 2FA, or platform roles.
- Business membership and business-level roles.
- Subscription, plan, billing, invoices, or limits.
- File attachments beyond `attachmentKey` string references.
- Fixed assets and depreciation.
- Tax configuration and tax filings.
- Bank accounts, imported bank statements, or bank reconciliation.
- Cash drawers, cash sessions, cash movements, and cash reconciliations used by `src/features/cash`.
- Sales orders and sales order items.
- Purchase orders, purchase receipts, and purchase returns.
- Payment module wallet/payment transaction/allocation/receivable tables.
- POS terminals, POS sessions, POS transactions, cart items, and receipts.
- Notification jobs, queue jobs, exports, or report artifact storage.

## Implementation Completeness

### End-to-End With Prisma Infrastructure

These modules have domain/application logic and Prisma repositories:

- Accounting
- Business
- Chart of Accounts
- Cash Management
- Revenue
- Tourism
- AR/AP
- Float Management
- Inventory
- Reporting

### Domain/Application Only

These modules have meaningful business logic but no Prisma infrastructure:

- Cash Sessions
- Sales
- Purchase
- Payment
- POS

### Planned in PRD but Not Present in Code

- Frontend web app.
- API layer.
- Authentication and authorization.
- Multi-user team/member management.
- God Mode/admin panel.
- Fixed assets.
- Tax.
- Bank reconciliation.
- Export PDF/Excel implementation.
- Dashboard analytics.
- Notifications and reminders.
- PWA/offline synchronization.
- Marketplace/bank/DJP integrations.
- Payroll.
- AI assistant.
- Multi-currency.

## Missing Modules

### Platform and Access Control

Required modules:

- User account management.
- Authentication/session management.
- Platform roles: `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`, `DEVELOPER`, `USER`.
- Business roles: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`, `ACCOUNTANT`, `CASHIER`.
- Business membership table and permission checks.
- Admin/God Mode session separation, 2FA enforcement, impersonation audit, and platform audit logs.

Why it matters:

- Current services trust `actorUserId` and `businessId` from callers.
- There is no authoritative access-control boundary.

### API and Application Shell

Required modules:

- HTTP or RPC API routes/controllers.
- Request validation DTOs.
- Authenticated tenant context builder.
- Error mapping and response format.
- Frontend or client application.

Why it matters:

- Current services are library code, not a runnable product.

### Persistence for Advanced Operations

Required persistence modules:

- Cash drawer/session tables and repository.
- Sales tables and repository.
- Purchase tables and repository.
- Payment wallet/transaction/allocation/receivable tables and repository.
- POS tables and repository.

Why it matters:

- Existing services cannot be run end-to-end against the database until these models and adapters exist.

### Compliance and Financial Product Gaps

Required modules:

- Fixed asset register and depreciation.
- Tax setup and transaction tax lines.
- Bank reconciliation.
- Report export and report snapshots.
- Period-end closing entries.
- Data import/export tooling.

Why it matters:

- These are part of the PRD/MVP or Phase 2 expectations but are not yet implemented.

### Operational Infrastructure

Required modules:

- Prisma migrations.
- Seed scripts.
- CI for tests/typecheck.
- Docker/dev database setup.
- Environment configuration examples.
- Observability/error tracking.
- Background job queue for exports, notifications, and heavy reports.

## Implementation Roadmap

### Phase 1: Stabilize Core Accounting Backend

1. Add Prisma migrations and seed scripts.
2. Add app-level composition root for Prisma repositories and services.
3. Run and fix `npm run typecheck` and `npm test` as the acceptance baseline.
4. Review schema/client compatibility for enum representations, especially account group codes versus Prisma enum names.
5. Add integration tests for journal posting, chart seeding, fiscal periods, cash management, revenue, AR/AP, inventory, and reporting with a real test database.
6. Add transaction boundaries around multi-write service operations.

### Phase 2: Add Identity, Tenancy, and Permissions

1. Add `User`, auth/session, and credentials/2FA models.
2. Add `BusinessMember` with business roles.
3. Add permission guards around service entrypoints or API handlers.
4. Add platform role models and platform audit logs.
5. Implement God Mode requirements from the addendum with separate admin sessions and impersonation auditing.

### Phase 3: Expose the Product Through an API

1. Choose API shape: Next.js route handlers, Hono, tRPC, or REST.
2. Add request validation and error mapping.
3. Build tenant context from authenticated session and selected business.
4. Add endpoints for business, chart of accounts, journal posting, cash, revenue, AR/AP, inventory, tourism, and reporting.
5. Add OpenAPI or generated API documentation.

### Phase 4: Complete Persistence for Existing Domain Modules

1. Add schema and repositories for cash sessions.
2. Add schema and repositories for sales.
3. Add schema and repositories for purchase.
4. Add schema and repositories for payment wallets/allocations/receivables.
5. Add schema and repositories for POS.
6. Add cross-module integration tests for POS -> sales -> inventory/payment -> accounting.

### Phase 5: Build User-Facing Workflows

1. Build onboarding: create business, seed chart, open period, enter beginning balances.
2. Build transaction screens for cash, revenue, invoice/bill, payment, inventory, and tourism.
3. Build report screens for general ledger, trial balance, income statement, and balance sheet.
4. Add export to PDF/Excel.
5. Add dashboard summaries based on posted journals and operational records.

### Phase 6: Add Phase 2 PRD Capabilities

1. Fixed assets and depreciation.
2. Tax configuration, tax lines, and basic PPN/PPh reports.
3. Bank statement import and reconciliation.
4. Notifications for due invoices/bills and period close tasks.
5. BUMDes-specific report formats.
6. Offline/PWA behavior if still required by product scope.

### Phase 7: Production Readiness

1. Add CI/CD.
2. Add Docker Compose or managed development database setup.
3. Add structured logging and error tracking.
4. Add backup/restore process.
5. Add audit export and data retention policy.
6. Add performance indexes based on report and transaction query plans.
7. Add security review for tenant isolation, role enforcement, audit immutability, and admin access.

## Architectural Risks

### Tenant Isolation Is Caller-Enforced

Services consistently carry `businessId`, but there is no auth or membership layer to prove the caller can access the business. This should be fixed before exposing APIs.

### Several Services Outrun the Schema

Sales, purchase, POS, payment, and cash session services represent intended architecture but cannot be persisted with the current Prisma schema. Treat them as design/logic prototypes until their schemas and repositories are added.

### Transactions Are Critical

Many application services perform several writes: post journal, update domain record, write audit log. These should run in a database transaction to avoid mismatched accounting and operational state.

### Audit Logs Are Tenant-Only

Platform actions from God Mode and user/account lifecycle events need audit records that may not belong to a single business. The current `AuditLog.businessId` requirement is too restrictive for platform audit.

### Reversal Strategy Is Mixed

Some flows void by posting reversing journals and marking source rows void. `JournalEntry` also has reversal fields, but services do not consistently use journal reversal relationships. A single reversal policy should be defined.

### Reporting Needs Period-End Semantics

Balance sheet currently includes current-period earnings derived from income statement lines. The roadmap should define period close, retained earnings, and opening balance carry-forward behavior.

## Recommended Next Technical Decisions

1. Decide whether this repo remains backend/domain-only or becomes a full Next.js app.
2. Define the canonical database schema for auth, roles, and memberships before any API exposure.
3. Decide whether sales/purchase/payment/POS should be first-class MVP modules or deferred.
4. Standardize transaction handling in repositories and services.
5. Add a small composition/integration test harness with PostgreSQL to verify Prisma mappings and accounting invariants.
