# Sales And Cash CRUD Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build role-aware CRUD for formal sales orders, daily sales, and cash transactions.

**Architecture:** Add explicit service/repository methods for draft mutation and void behavior, then expose them through per-id API routes. The UI uses existing glass components and only offers actions allowed by role and record status.

**Tech Stack:** Next.js App Router API routes, TypeScript, Prisma, Vitest, React, TanStack Query, existing glass/shadcn-style UI.

---

### Task 1: Permission Helpers

**Files:**
- Modify: `src/presentation/auth/permissions.ts`
- Test: `tests/presentation/rbac-permissions.test.ts`

- [ ] Add helper functions or role checks for sales/cash read, mutate, void, and delete-draft workflows.
- [ ] Run focused permission tests and ensure existing route permission behavior remains unchanged.

### Task 2: Cash Transaction Draft Delete And Detail

**Files:**
- Modify: `src/features/cash-management/application/cash-repository.ts`
- Modify: `src/features/cash-management/application/cash-service.ts`
- Modify: `src/features/cash-management/infrastructure/prisma-cash-repository.ts`
- Test: `tests/cash-management/cash-service.test.ts`
- Create: `app/api/cash/transactions/[transactionId]/route.ts`

- [ ] Write failing tests for detail, draft update, draft delete, and rejecting delete for posted transactions.
- [ ] Implement repository `deleteDraft` and service `deleteDraft` with DRAFT-only enforcement.
- [ ] Add per-id route with `GET`, `PATCH`, and `DELETE`, including role checks.

### Task 3: Formal Sales Order Draft CRUD And Void

**Files:**
- Modify: `src/features/sales/application/sales-repository.ts`
- Modify: `src/features/sales/application/sales-service.ts`
- Modify: `src/features/sales/infrastructure/prisma-sales-repository.ts`
- Test: `tests/sales/sales-service.test.ts`
- Create: `app/api/sales/orders/[orderId]/route.ts`
- Create: `app/api/sales/orders/[orderId]/void/route.ts`

- [ ] Write failing tests for finding detail, updating draft, deleting draft, rejecting update/delete after confirmation, and voiding confirmed orders.
- [ ] Implement draft update by replacing items inside a transaction and recomputing totals through `SalesEngine`.
- [ ] Implement draft delete as hard delete only for DRAFT.
- [ ] Implement void by marking the order `VOID` and writing an audit log; journal reversal can be added later if source journal lines are not yet recoverable.
- [ ] Add API routes with strict role checks.

### Task 4: Daily Sale Detail And Void

**Files:**
- Create: `app/api/sales/daily/[saleId]/route.ts`
- Modify: `app/api/sales/daily/list/route.ts`
- Test: add coverage in `tests/presentation/api-validation.test.ts` or a new daily sales route test if route tests already support session mocking.

- [ ] Add detail route for daily sales.
- [ ] Add void route behavior through `DELETE`: if `journalId` exists, create a reversing journal and remove or mark the daily sale according to available schema fields.
- [ ] Because `DailySale` has no status field, prefer adding a reversible marker only if a migration is acceptable; otherwise delete only unjournaled rows and reject journaled rows with a clear message until a status migration is added.

### Task 5: Cash Transactions UI

**Files:**
- Modify: `app/(app)/cash/transactions/page.tsx`

- [ ] Replace direct "save and post" only flow with draft-first controls.
- [ ] Add row actions for detail, edit draft, post draft, void posted, and delete draft.
- [ ] Hide or disable actions by role/status.
- [ ] Keep existing design system constraints: no browser alert/confirm/prompt and no bare native form controls.

### Task 6: Sales Orders UI

**Files:**
- Modify: `app/(app)/sales/orders/page.tsx`

- [ ] Keep daily sale entry but add row actions for detail and void.
- [ ] Add a formal sales order list/action surface using `/api/sales/orders/list`.
- [ ] Add draft edit/delete/confirm/void actions for formal sales orders.
- [ ] Hide or disable actions by role/status.

### Task 7: Verification

**Files:**
- No production files.

- [ ] Run `npm test -- tests/cash-management/cash-service.test.ts tests/sales/sales-service.test.ts tests/presentation/rbac-permissions.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Start the dev server and inspect `/sales/orders` and `/cash/transactions` in the browser if typecheck passes.
