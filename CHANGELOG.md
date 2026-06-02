# Changelog

All notable changes to AkuntansiMu are documented in this file.

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
