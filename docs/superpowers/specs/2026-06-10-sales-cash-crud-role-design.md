# Sales And Cash CRUD Role Design

**Goal:** Activate CRUD workflows for formal sales orders, daily sales, and cash transactions while protecting accounting integrity with role and status rules.

## Scope

- Formal `SalesOrder` CRUD: create, list/detail, edit draft, delete draft, confirm, and void confirmed/paid orders.
- `DailySale` CRUD on `/sales/orders`: list/detail, create posted daily sale, and void posted daily sale with reversing journal. Direct edit/delete is not allowed once a journal exists.
- `CashTransaction` CRUD on `/cash/transactions`: create draft, edit draft, delete draft, post draft, and void posted transaction.

## Role Rules

- Read/list/detail: `OWNER`, `ADMIN`, `ACCOUNTANT`, `CASHIER`, `VIEWER`.
- Create/edit/post/confirm draft: `OWNER`, `ADMIN`, `CASHIER`.
- Void posted or confirmed records: `OWNER`, `ADMIN`.
- Hard delete draft: `OWNER`, `ADMIN`.
- `ACCOUNTANT` can inspect but not mutate these workflows unless a later requirement grants write access.
- `VIEWER` is read-only.

## Status Rules

- Draft records may be edited before posting/confirmation.
- Draft records may be hard-deleted by `OWNER` or `ADMIN`.
- Posted/confirmed/paid records must not be edited or hard-deleted.
- Posted/confirmed/paid records may only be voided by `OWNER` or `ADMIN`.
- Voids must create audit-friendly reversal state; where a journal exists, the operation must create or reference a reversing journal.

## API Design

- Add route-level handlers for `/api/sales/orders/[orderId]` with `GET`, `PATCH`, and `DELETE`.
- Add `/api/sales/orders/[orderId]/void` for confirmed/paid sales order voiding.
- Add route-level handlers for `/api/sales/daily/[saleId]` with `GET` and `DELETE`. `DELETE` voids if journaled; no hard delete for journaled daily sales.
- Add `/api/cash/transactions/[transactionId]` with `GET`, `PATCH`, and `DELETE`.
- Existing `/api/cash/transactions/post` and `/api/cash/transactions/void` remain the posting and void endpoints.

## UI Design

- `/sales/orders` should show both daily sale history actions and a formal sales order section or mode.
- `/cash/transactions` should expose draft save, edit, post, void, and delete draft actions.
- Action buttons must be hidden or disabled based on role and status.
- Destructive actions use app dialogs/toasts, not browser alerts.

## Testing

- Service tests cover draft edit/delete and posted/confirmed mutation rejection.
- API/permission tests cover allowed and forbidden roles.
- Typecheck must pass after implementation.
