-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountGroupCode" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('UMKM', 'BUMDES', 'PERORANGAN', 'CV', 'UD');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BusinessMemberRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER', 'VIEWER');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "BeginningBalanceStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH', 'OTHER');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('CASH_IN', 'CASH_OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CashTransactionStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "RevenueType" AS ENUM ('TICKET', 'PACKAGE', 'PARKING', 'RENTAL', 'TENANT_RENT', 'SERVICE', 'PRODUCT_SALE', 'OTHER_REVENUE');

-- CreateEnum
CREATE TYPE "RevenueTransactionStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "RevenuePricingType" AS ENUM ('STANDARD', 'TIER', 'DAILY', 'WEEKEND', 'SEASONAL', 'PACKAGE');

-- CreateEnum
CREATE TYPE "TourismRentalType" AS ENUM ('GAZEBO', 'AREA', 'EVENT');

-- CreateEnum
CREATE TYPE "VisitorTransactionSource" AS ENUM ('ENTRANCE_TICKET', 'PACKAGE_TICKET', 'PARKING_FEE', 'GAZEBO_RENTAL', 'AREA_RENTAL', 'TENANT_RENTAL', 'EVENT_RENTAL');

-- CreateEnum
CREATE TYPE "VisitorTransactionStatus" AS ENUM ('DRAFT', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "ReceivablePayableStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('CUSTOMER_PAYMENT', 'VENDOR_PAYMENT');

-- CreateEnum
CREATE TYPE "AdjustmentNoteType" AS ENUM ('CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "FloatProvider" AS ENUM ('BUKUWARUNG', 'FASTPAY', 'PAYFAZZ', 'SHOPEEPAY', 'LINKAJA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FloatTransactionType" AS ENUM ('TOPUP', 'CONSUME', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductPriceType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER', 'SALE', 'PURCHASE', 'DIGITAL_CONSUMPTION');

-- CreateEnum
CREATE TYPE "InventoryCostHistorySource" AS ENUM ('PRICE_UPDATE', 'STOCK_IN', 'DIGITAL_PROVIDER');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'BANK', 'QRIS', 'FLOAT', 'CUSTOMER_WALLET', 'ACCOUNTS_RECEIVABLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'SPEND', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('JOURNAL_POSTED', 'JOURNAL_POST_REJECTED', 'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_DEACTIVATED', 'ACCOUNT_DELETED', 'CHART_OF_ACCOUNTS_SEEDED', 'BUSINESS_CREATED', 'BUSINESS_SETTINGS_UPDATED', 'FISCAL_PERIOD_OPENED', 'FISCAL_PERIOD_CLOSED', 'FISCAL_PERIOD_REOPENED', 'BEGINNING_BALANCE_SAVED', 'BEGINNING_BALANCE_POSTED', 'CONTACT_CREATED', 'CASH_TRANSACTION_DRAFTED', 'CASH_TRANSACTION_UPDATED', 'CASH_TRANSACTION_POSTED', 'CASH_TRANSACTION_VOIDED', 'CASH_JOURNAL_PREVIEWED', 'REPORT_GENERATED', 'REVENUE_CATEGORY_CREATED', 'REVENUE_ITEM_CREATED', 'REVENUE_PACKAGE_CREATED', 'REVENUE_PRICING_CREATED', 'REVENUE_TRANSACTION_DRAFTED', 'REVENUE_TRANSACTION_POSTED', 'REVENUE_TRANSACTION_VOIDED', 'ATTRACTION_CREATED', 'TICKET_TYPE_CREATED', 'TICKET_PACKAGE_CREATED', 'PARKING_SERVICE_CREATED', 'RENTAL_SERVICE_CREATED', 'TENANT_RENTAL_CREATED', 'VISITOR_TRANSACTION_DRAFTED', 'VISITOR_TRANSACTION_PAID', 'VISITOR_TRANSACTION_VOIDED', 'TICKET_VALIDATED', 'CUSTOMER_CREATED', 'VENDOR_CREATED', 'INVOICE_DRAFTED', 'INVOICE_POSTED', 'BILL_DRAFTED', 'BILL_POSTED', 'PAYMENT_RECORDED', 'CREDIT_NOTE_APPLIED', 'DEBIT_NOTE_APPLIED', 'FLOAT_ACCOUNT_CREATED', 'FLOAT_TOPUP_POSTED', 'FLOAT_CONSUMPTION_POSTED', 'FLOAT_TRANSFER_POSTED', 'FLOAT_ADJUSTMENT_POSTED', 'FLOAT_BALANCE_SNAPSHOT_CREATED', 'PRODUCT_CREATED', 'PRODUCT_PRICE_UPDATED', 'INVENTORY_STOCK_IN', 'INVENTORY_STOCK_OUT', 'INVENTORY_ADJUSTED', 'INVENTORY_TRANSFERRED', 'DIGITAL_PRODUCT_CONSUMED', 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_APPROVED', 'PURCHASE_ORDER_RECEIVED', 'PURCHASE_RETURN_CREATED', 'PURCHASE_VENDOR_BILL_GENERATED', 'CASH_SESSION_OPENED', 'CASH_SESSION_CLOSED', 'CASH_MOVEMENT_RECORDED', 'CASH_TRANSFER_RECORDED', 'CASH_RECONCILED', 'POS_SESSION_OPENED', 'POS_SESSION_CLOSED', 'POS_CART_UPDATED', 'POS_TRANSACTION_CHECKED_OUT', 'POS_PAYMENT_ALLOCATED', 'POS_CHANGE_SAVED_TO_DEPOSIT', 'POS_TRANSACTION_VOIDED', 'SALES_ORDER_CREATED', 'SALES_ORDER_CONFIRMED', 'SALES_PAYMENT_ALLOCATED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('OPENING_BALANCE', 'SALE_RECEIPT', 'CUSTOMER_DEPOSIT', 'EXPENSE', 'WITHDRAWAL', 'TRANSFER', 'ADJUSTMENT', 'CLOSING');

-- CreateEnum
CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosTransactionStatus" AS ENUM ('DRAFT', 'CHECKOUT', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL DEFAULT 'UMKM',
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "npwp_number" TEXT,
    "address" TEXT,
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "settings" JSONB,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active_business_id" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "BusinessMemberRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_code" "AccountGroupCode" NOT NULL,
    "subtype" TEXT,
    "description" TEXT,
    "normal_balance" "NormalBalance" NOT NULL,
    "parent_id" TEXT,
    "parent_code" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_posting_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "closed_by_user_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopened_by_user_id" TEXT,
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "fiscal_period_id" TEXT NOT NULL,
    "journal_number" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "description" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "total_debit" BIGINT NOT NULL,
    "total_credit" BIGINT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "reversed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "side" "JournalSide" NOT NULL,
    "amount" BIGINT NOT NULL,
    "memo" TEXT,
    "line_no" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'OTHER',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "status" "CashTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "transaction_date" DATE NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "destination_account_id" TEXT,
    "category_account_id" TEXT,
    "contact_id" TEXT,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "payment_method" TEXT,
    "reference_number" TEXT,
    "attachment_key" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "posted_journal_id" TEXT,
    "void_journal_id" TEXT,
    "void_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "voided_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_categories" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RevenueType" NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_items" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_packages" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_pricings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "item_id" TEXT,
    "package_id" TEXT,
    "type" "RevenuePricingType" NOT NULL,
    "tier_name" TEXT,
    "amount" BIGINT NOT NULL,
    "starts_on" DATE,
    "ends_on" DATE,
    "day_of_week" INTEGER,
    "min_quantity" INTEGER,
    "max_quantity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "status" "RevenueTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "RevenueType" NOT NULL,
    "transaction_date" DATE NOT NULL,
    "category_id" TEXT NOT NULL,
    "item_id" TEXT,
    "package_id" TEXT,
    "pricing_id" TEXT,
    "cash_account_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "contact_id" TEXT,
    "posted_journal_id" TEXT,
    "void_journal_id" TEXT,
    "void_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "voided_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attractions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "visitor_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revenue_category_id" TEXT NOT NULL,
    "daily_price" BIGINT NOT NULL,
    "weekend_price" BIGINT,
    "seasonal_price" BIGINT,
    "seasonal_starts_on" DATE,
    "seasonal_ends_on" DATE,
    "visitor_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_packages" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revenue_category_id" TEXT NOT NULL,
    "package_price" BIGINT NOT NULL,
    "max_visitors" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_services" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revenue_category_id" TEXT NOT NULL,
    "daily_price" BIGINT NOT NULL,
    "weekend_price" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_services" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TourismRentalType" NOT NULL,
    "revenue_category_id" TEXT NOT NULL,
    "daily_price" BIGINT NOT NULL,
    "weekend_price" BIGINT,
    "seasonal_price" BIGINT,
    "seasonal_starts_on" DATE,
    "seasonal_ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_rentals" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "revenue_category_id" TEXT NOT NULL,
    "rental_price" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "status" "VisitorTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "VisitorTransactionSource" NOT NULL,
    "transaction_date" DATE NOT NULL,
    "attraction_id" TEXT NOT NULL,
    "ticket_type_id" TEXT,
    "ticket_package_id" TEXT,
    "parking_service_id" TEXT,
    "rental_service_id" TEXT,
    "tenant_rental_id" TEXT,
    "cash_account_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "visitor_count" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "validation_code" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "qr_payload" JSONB,
    "booking_reference" TEXT,
    "revenue_transaction_id" TEXT,
    "void_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "ReceivablePayableStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "ar_account_id" TEXT NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "ReceivablePayableStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "ap_account_id" TEXT NOT NULL,
    "expense_account_id" TEXT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "payment_number" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "invoice_id" TEXT,
    "bill_id" TEXT,
    "customer_id" TEXT,
    "vendor_id" TEXT,
    "payment_date" DATE NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_notes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "note_number" TEXT NOT NULL,
    "type" "AdjustmentNoteType" NOT NULL,
    "invoice_id" TEXT,
    "bill_id" TEXT,
    "customer_id" TEXT,
    "vendor_id" TEXT,
    "note_date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustment_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "float_accounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "provider" "FloatProvider" NOT NULL,
    "provider_account_id" TEXT,
    "name" TEXT NOT NULL,
    "float_asset_account_id" TEXT NOT NULL,
    "offset_account_id" TEXT NOT NULL,
    "current_balance" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "float_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "float_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "type" "FloatTransactionType" NOT NULL,
    "float_account_id" TEXT NOT NULL,
    "destination_float_account_id" TEXT,
    "cash_account_id" TEXT,
    "transaction_date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "float_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "float_balance_snapshots" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "float_account_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "balance" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "float_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "inventory_account_id" TEXT,
    "cogs_account_id" TEXT,
    "revenue_account_id" TEXT NOT NULL,
    "track_stock" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price_type" "ProductPriceType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "effective_date" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL DEFAULT 0,
    "average_cost" BIGINT NOT NULL DEFAULT 0,
    "inventory_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "movement_date" DATE NOT NULL,
    "quantity" BIGINT NOT NULL,
    "unit_cost" BIGINT NOT NULL,
    "total_cost" BIGINT NOT NULL,
    "from_warehouse_id" TEXT,
    "to_warehouse_id" TEXT,
    "balance_after" BIGINT NOT NULL,
    "average_cost_after" BIGINT NOT NULL,
    "posted_journal_id" TEXT,
    "description" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cost_histories" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "previous_cost" BIGINT NOT NULL DEFAULT 0,
    "new_cost" BIGINT NOT NULL,
    "sell_price" BIGINT,
    "margin_amount" BIGINT,
    "margin_rate_bps" BIGINT,
    "effective_date" DATE NOT NULL,
    "source" "InventoryCostHistorySource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_cost_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_products" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "provider" "FloatProvider" NOT NULL,
    "provider_code" TEXT NOT NULL,
    "float_account_id" TEXT NOT NULL,
    "provider_buy_price" BIGINT,
    "provider_sell_price" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beginning_balances" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "fiscal_period_id" TEXT NOT NULL,
    "side" "JournalSide" NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "BeginningBalanceStatus" NOT NULL DEFAULT 'DRAFT',
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beginning_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "sales_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sale_date" DATE NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "discount_total" BIGINT NOT NULL DEFAULT 0,
    "tax_total" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "revenue_settlement_account_id" TEXT NOT NULL,
    "ar_account_id" TEXT,
    "payment_transaction_id" TEXT,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "quantity" BIGINT NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "line_total" BIGINT NOT NULL,
    "location_id" TEXT,
    "provider_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_wallets" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "deposit_liability_account_id" TEXT NOT NULL,
    "current_balance" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_wallet_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "transaction_date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" TEXT,
    "float_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "productId" TEXT,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "payment_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "allocated_amount" BIGINT NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "description" TEXT NOT NULL,
    "revenue_settlement_account_id" TEXT NOT NULL,
    "ar_account_id" TEXT,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "payment_transaction_id" TEXT NOT NULL,
    "method" "PaymentMethodType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "account_id" TEXT,
    "wallet_id" TEXT,
    "float_account_id" TEXT,
    "receivable_id" TEXT,
    "posted_journal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "ar_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "subtotal" BIGINT NOT NULL,
    "discount_total" BIGINT NOT NULL DEFAULT 0,
    "tax_total" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL,
    "grni_account_id" TEXT NOT NULL,
    "ap_account_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "description" TEXT,
    "quantity" BIGINT NOT NULL,
    "received_quantity" BIGINT NOT NULL DEFAULT 0,
    "unit_cost" BIGINT NOT NULL,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "line_total" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "receipt_date" DATE NOT NULL,
    "total_cost" BIGINT NOT NULL,
    "posted_journal_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "return_date" DATE NOT NULL,
    "total_cost" BIGINT NOT NULL,
    "posted_journal_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_drawers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_drawers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "drawer_id" TEXT NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "opening_amount" BIGINT NOT NULL,
    "expected_closing_amount" BIGINT NOT NULL,
    "counted_closing_amount" BIGINT,
    "difference_amount" BIGINT,
    "opened_by_user_id" TEXT NOT NULL,
    "closed_by_user_id" TEXT,
    "shift_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "session_id" TEXT,
    "drawer_id" TEXT,
    "type" "CashMovementType" NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "destination_cash_account_id" TEXT,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "posted_journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_reconciliations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "expected_amount" BIGINT NOT NULL,
    "counted_amount" BIGINT NOT NULL,
    "difference_amount" BIGINT NOT NULL,
    "reconciled_at" TIMESTAMP(3) NOT NULL,
    "posted_journal_id" TEXT,
    "reconciled_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_terminals" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cash_drawer_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "cash_session_id" TEXT,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "opening_amount" BIGINT NOT NULL,
    "expected_closing_amount" BIGINT NOT NULL,
    "counted_closing_amount" BIGINT,
    "difference_amount" BIGINT,
    "opened_by_user_id" TEXT NOT NULL,
    "closed_by_user_id" TEXT,
    "shift_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_transactions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "PosTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "transaction_date" DATE NOT NULL,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount_total" BIGINT NOT NULL DEFAULT 0,
    "tax_total" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL DEFAULT 0,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "change_amount" BIGINT NOT NULL DEFAULT 0,
    "sales_order_id" TEXT,
    "payment_transaction_id" TEXT,
    "receipt_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_cart_items" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "unit_price" BIGINT,
    "price_id" TEXT,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "discount_percent_bps" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "location_id" TEXT,
    "provider_product_id" TEXT,
    "barcode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_receipts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL,
    "change_amount" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "businesses_created_by_user_id_idx" ON "businesses"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "business_members_user_id_is_active_idx" ON "business_members"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "business_members_business_id_role_idx" ON "business_members"("business_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts"("provider_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_value_key" ON "verification_tokens"("identifier", "value");

-- CreateIndex
CREATE INDEX "accounts_business_id_parent_id_idx" ON "accounts"("business_id", "parent_id");

-- CreateIndex
CREATE INDEX "accounts_business_id_parent_code_idx" ON "accounts"("business_id", "parent_code");

-- CreateIndex
CREATE INDEX "accounts_business_id_group_code_idx" ON "accounts"("business_id", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_business_id_code_key" ON "accounts"("business_id", "code");

-- CreateIndex
CREATE INDEX "fiscal_periods_business_id_starts_on_ends_on_status_idx" ON "fiscal_periods"("business_id", "starts_on", "ends_on", "status");

-- CreateIndex
CREATE INDEX "fiscal_periods_business_id_is_closed_idx" ON "fiscal_periods"("business_id", "is_closed");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_business_id_fiscal_year_key" ON "fiscal_periods"("business_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversed_by_id_key" ON "journal_entries"("reversed_by_id");

-- CreateIndex
CREATE INDEX "journal_entries_business_id_transaction_date_idx" ON "journal_entries"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "journal_entries_business_id_source_source_id_idx" ON "journal_entries"("business_id", "source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_business_id_journal_number_key" ON "journal_entries"("business_id", "journal_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_business_id_idempotency_key_key" ON "journal_entries"("business_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "journal_lines_business_id_account_id_idx" ON "journal_lines"("business_id", "account_id");

-- CreateIndex
CREATE INDEX "journal_lines_business_id_journal_id_idx" ON "journal_lines"("business_id", "journal_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journal_id_line_no_key" ON "journal_lines"("journal_id", "line_no");

-- CreateIndex
CREATE INDEX "contacts_business_id_type_idx" ON "contacts"("business_id", "type");

-- CreateIndex
CREATE INDEX "contacts_business_id_name_idx" ON "contacts"("business_id", "name");

-- CreateIndex
CREATE INDEX "cash_transactions_business_id_transaction_date_idx" ON "cash_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "cash_transactions_business_id_status_idx" ON "cash_transactions"("business_id", "status");

-- CreateIndex
CREATE INDEX "cash_transactions_business_id_type_idx" ON "cash_transactions"("business_id", "type");

-- CreateIndex
CREATE INDEX "cash_transactions_business_id_contact_id_idx" ON "cash_transactions"("business_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transactions_business_id_transaction_number_key" ON "cash_transactions"("business_id", "transaction_number");

-- CreateIndex
CREATE INDEX "revenue_categories_business_id_type_idx" ON "revenue_categories"("business_id", "type");

-- CreateIndex
CREATE INDEX "revenue_categories_business_id_revenue_account_id_idx" ON "revenue_categories"("business_id", "revenue_account_id");

-- CreateIndex
CREATE INDEX "revenue_items_business_id_category_id_idx" ON "revenue_items"("business_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_items_business_id_sku_key" ON "revenue_items"("business_id", "sku");

-- CreateIndex
CREATE INDEX "revenue_packages_business_id_category_id_idx" ON "revenue_packages"("business_id", "category_id");

-- CreateIndex
CREATE INDEX "revenue_pricings_business_id_item_id_idx" ON "revenue_pricings"("business_id", "item_id");

-- CreateIndex
CREATE INDEX "revenue_pricings_business_id_package_id_idx" ON "revenue_pricings"("business_id", "package_id");

-- CreateIndex
CREATE INDEX "revenue_pricings_business_id_type_idx" ON "revenue_pricings"("business_id", "type");

-- CreateIndex
CREATE INDEX "revenue_transactions_business_id_transaction_date_idx" ON "revenue_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "revenue_transactions_business_id_status_idx" ON "revenue_transactions"("business_id", "status");

-- CreateIndex
CREATE INDEX "revenue_transactions_business_id_type_idx" ON "revenue_transactions"("business_id", "type");

-- CreateIndex
CREATE INDEX "revenue_transactions_business_id_category_id_idx" ON "revenue_transactions"("business_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_transactions_business_id_transaction_number_key" ON "revenue_transactions"("business_id", "transaction_number");

-- CreateIndex
CREATE INDEX "attractions_business_id_is_active_idx" ON "attractions"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "ticket_types_business_id_attraction_id_idx" ON "ticket_types"("business_id", "attraction_id");

-- CreateIndex
CREATE INDEX "ticket_packages_business_id_attraction_id_idx" ON "ticket_packages"("business_id", "attraction_id");

-- CreateIndex
CREATE INDEX "parking_services_business_id_attraction_id_idx" ON "parking_services"("business_id", "attraction_id");

-- CreateIndex
CREATE INDEX "rental_services_business_id_attraction_id_idx" ON "rental_services"("business_id", "attraction_id");

-- CreateIndex
CREATE INDEX "tenant_rentals_business_id_attraction_id_idx" ON "tenant_rentals"("business_id", "attraction_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_transactions_validation_code_key" ON "visitor_transactions"("validation_code");

-- CreateIndex
CREATE INDEX "visitor_transactions_business_id_transaction_date_idx" ON "visitor_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "visitor_transactions_business_id_status_idx" ON "visitor_transactions"("business_id", "status");

-- CreateIndex
CREATE INDEX "visitor_transactions_business_id_source_idx" ON "visitor_transactions"("business_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_transactions_business_id_transaction_number_key" ON "visitor_transactions"("business_id", "transaction_number");

-- CreateIndex
CREATE INDEX "customers_business_id_name_idx" ON "customers"("business_id", "name");

-- CreateIndex
CREATE INDEX "vendors_business_id_name_idx" ON "vendors"("business_id", "name");

-- CreateIndex
CREATE INDEX "invoices_business_id_status_idx" ON "invoices"("business_id", "status");

-- CreateIndex
CREATE INDEX "invoices_business_id_due_date_idx" ON "invoices"("business_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_business_id_invoice_number_key" ON "invoices"("business_id", "invoice_number");

-- CreateIndex
CREATE INDEX "bills_business_id_status_idx" ON "bills"("business_id", "status");

-- CreateIndex
CREATE INDEX "bills_business_id_due_date_idx" ON "bills"("business_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "bills_business_id_bill_number_key" ON "bills"("business_id", "bill_number");

-- CreateIndex
CREATE INDEX "payments_business_id_payment_date_idx" ON "payments"("business_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_business_id_payment_number_key" ON "payments"("business_id", "payment_number");

-- CreateIndex
CREATE INDEX "adjustment_notes_business_id_note_date_idx" ON "adjustment_notes"("business_id", "note_date");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_notes_business_id_note_number_key" ON "adjustment_notes"("business_id", "note_number");

-- CreateIndex
CREATE INDEX "float_accounts_business_id_provider_idx" ON "float_accounts"("business_id", "provider");

-- CreateIndex
CREATE INDEX "float_transactions_business_id_transaction_date_idx" ON "float_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "float_transactions_business_id_type_idx" ON "float_transactions"("business_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "float_transactions_business_id_transaction_number_key" ON "float_transactions"("business_id", "transaction_number");

-- CreateIndex
CREATE UNIQUE INDEX "float_balance_snapshots_business_id_float_account_id_snapsh_key" ON "float_balance_snapshots"("business_id", "float_account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "product_categories_business_id_parent_id_idx" ON "product_categories"("business_id", "parent_id");

-- CreateIndex
CREATE INDEX "product_categories_business_id_is_active_idx" ON "product_categories"("business_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_business_id_name_parent_id_key" ON "product_categories"("business_id", "name", "parent_id");

-- CreateIndex
CREATE INDEX "products_business_id_barcode_idx" ON "products"("business_id", "barcode");

-- CreateIndex
CREATE INDEX "products_business_id_type_idx" ON "products"("business_id", "type");

-- CreateIndex
CREATE INDEX "products_business_id_category_id_idx" ON "products"("business_id", "category_id");

-- CreateIndex
CREATE INDEX "products_business_id_is_active_idx" ON "products"("business_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_business_id_sku_key" ON "products"("business_id", "sku");

-- CreateIndex
CREATE INDEX "product_prices_business_id_product_id_price_type_is_active_idx" ON "product_prices"("business_id", "product_id", "price_type", "is_active");

-- CreateIndex
CREATE INDEX "product_prices_business_id_product_id_effective_date_idx" ON "product_prices"("business_id", "product_id", "effective_date");

-- CreateIndex
CREATE INDEX "product_prices_business_id_priority_idx" ON "product_prices"("business_id", "priority");

-- CreateIndex
CREATE INDEX "inventory_balances_business_id_warehouse_id_idx" ON "inventory_balances"("business_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_business_id_product_id_warehouse_id_key" ON "inventory_balances"("business_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_movements_business_id_product_id_movement_date_idx" ON "inventory_movements"("business_id", "product_id", "movement_date");

-- CreateIndex
CREATE INDEX "inventory_movements_business_id_type_idx" ON "inventory_movements"("business_id", "type");

-- CreateIndex
CREATE INDEX "inventory_movements_business_id_from_warehouse_id_idx" ON "inventory_movements"("business_id", "from_warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_movements_business_id_to_warehouse_id_idx" ON "inventory_movements"("business_id", "to_warehouse_id");

-- CreateIndex
CREATE INDEX "product_cost_histories_business_id_product_id_effective_dat_idx" ON "product_cost_histories"("business_id", "product_id", "effective_date");

-- CreateIndex
CREATE INDEX "provider_products_business_id_product_id_idx" ON "provider_products"("business_id", "product_id");

-- CreateIndex
CREATE INDEX "provider_products_business_id_provider_idx" ON "provider_products"("business_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "provider_products_business_id_provider_provider_code_key" ON "provider_products"("business_id", "provider", "provider_code");

-- CreateIndex
CREATE INDEX "beginning_balances_business_id_fiscal_period_id_status_idx" ON "beginning_balances"("business_id", "fiscal_period_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beginning_balances_business_id_account_id_fiscal_period_id_key" ON "beginning_balances"("business_id", "account_id", "fiscal_period_id");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_actor_user_id_idx" ON "audit_logs"("business_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "sales_orders_business_id_sale_date_idx" ON "sales_orders"("business_id", "sale_date");

-- CreateIndex
CREATE INDEX "sales_orders_business_id_customer_id_idx" ON "sales_orders"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_business_id_status_idx" ON "sales_orders"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_business_id_sales_number_key" ON "sales_orders"("business_id", "sales_number");

-- CreateIndex
CREATE INDEX "sales_order_items_business_id_sales_order_id_idx" ON "sales_order_items"("business_id", "sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_items_business_id_product_id_idx" ON "sales_order_items"("business_id", "product_id");

-- CreateIndex
CREATE INDEX "customer_wallets_business_id_current_balance_idx" ON "customer_wallets"("business_id", "current_balance");

-- CreateIndex
CREATE UNIQUE INDEX "customer_wallets_business_id_customer_id_key" ON "customer_wallets"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_wallet_transactions_business_id_wallet_id_transact_idx" ON "customer_wallet_transactions"("business_id", "wallet_id", "transaction_date");

-- CreateIndex
CREATE INDEX "payment_methods_business_id_type_idx" ON "payment_methods"("business_id", "type");

-- CreateIndex
CREATE INDEX "payment_transactions_business_id_transaction_date_idx" ON "payment_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "payment_transactions_business_id_customer_id_idx" ON "payment_transactions"("business_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_business_id_payment_number_key" ON "payment_transactions"("business_id", "payment_number");

-- CreateIndex
CREATE INDEX "payment_allocations_business_id_payment_transaction_id_idx" ON "payment_allocations"("business_id", "payment_transaction_id");

-- CreateIndex
CREATE INDEX "receivables_business_id_customer_id_idx" ON "receivables"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "receivables_business_id_status_idx" ON "receivables"("business_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_business_id_order_date_idx" ON "purchase_orders"("business_id", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_business_id_supplier_id_idx" ON "purchase_orders"("business_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_business_id_status_idx" ON "purchase_orders"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_business_id_order_number_key" ON "purchase_orders"("business_id", "order_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_business_id_purchase_order_id_idx" ON "purchase_order_items"("business_id", "purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_business_id_product_id_idx" ON "purchase_order_items"("business_id", "product_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_business_id_purchase_order_id_idx" ON "purchase_receipts"("business_id", "purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_business_id_receipt_date_idx" ON "purchase_receipts"("business_id", "receipt_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_business_id_receipt_number_key" ON "purchase_receipts"("business_id", "receipt_number");

-- CreateIndex
CREATE INDEX "purchase_returns_business_id_purchase_order_id_idx" ON "purchase_returns"("business_id", "purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_returns_business_id_return_date_idx" ON "purchase_returns"("business_id", "return_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_business_id_return_number_key" ON "purchase_returns"("business_id", "return_number");

-- CreateIndex
CREATE INDEX "cash_drawers_business_id_is_active_idx" ON "cash_drawers"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "cash_sessions_business_id_drawer_id_status_idx" ON "cash_sessions"("business_id", "drawer_id", "status");

-- CreateIndex
CREATE INDEX "cash_sessions_business_id_opened_at_idx" ON "cash_sessions"("business_id", "opened_at");

-- CreateIndex
CREATE INDEX "cash_movements_business_id_session_id_movement_date_idx" ON "cash_movements"("business_id", "session_id", "movement_date");

-- CreateIndex
CREATE INDEX "cash_movements_business_id_type_idx" ON "cash_movements"("business_id", "type");

-- CreateIndex
CREATE INDEX "cash_reconciliations_business_id_session_id_idx" ON "cash_reconciliations"("business_id", "session_id");

-- CreateIndex
CREATE INDEX "pos_terminals_business_id_is_active_idx" ON "pos_terminals"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "pos_sessions_business_id_terminal_id_status_idx" ON "pos_sessions"("business_id", "terminal_id", "status");

-- CreateIndex
CREATE INDEX "pos_sessions_business_id_opened_at_idx" ON "pos_sessions"("business_id", "opened_at");

-- CreateIndex
CREATE INDEX "pos_transactions_business_id_session_id_idx" ON "pos_transactions"("business_id", "session_id");

-- CreateIndex
CREATE INDEX "pos_transactions_business_id_status_idx" ON "pos_transactions"("business_id", "status");

-- CreateIndex
CREATE INDEX "pos_transactions_business_id_transaction_date_idx" ON "pos_transactions"("business_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "pos_transactions_business_id_transaction_number_key" ON "pos_transactions"("business_id", "transaction_number");

-- CreateIndex
CREATE INDEX "pos_cart_items_business_id_transaction_id_idx" ON "pos_cart_items"("business_id", "transaction_id");

-- CreateIndex
CREATE INDEX "pos_cart_items_business_id_product_id_idx" ON "pos_cart_items"("business_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_receipts_transaction_id_key" ON "pos_receipts"("transaction_id");

-- CreateIndex
CREATE INDEX "pos_receipts_business_id_issued_at_idx" ON "pos_receipts"("business_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "pos_receipts_business_id_receipt_number_key" ON "pos_receipts"("business_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_category_account_id_fkey" FOREIGN KEY ("category_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_categories" ADD CONSTRAINT "revenue_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_categories" ADD CONSTRAINT "revenue_categories_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_items" ADD CONSTRAINT "revenue_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_items" ADD CONSTRAINT "revenue_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_packages" ADD CONSTRAINT "revenue_packages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_packages" ADD CONSTRAINT "revenue_packages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_pricings" ADD CONSTRAINT "revenue_pricings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_pricings" ADD CONSTRAINT "revenue_pricings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "revenue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_pricings" ADD CONSTRAINT "revenue_pricings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "revenue_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "revenue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "revenue_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_transactions" ADD CONSTRAINT "revenue_transactions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_packages" ADD CONSTRAINT "ticket_packages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_packages" ADD CONSTRAINT "ticket_packages_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_services" ADD CONSTRAINT "parking_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_services" ADD CONSTRAINT "parking_services_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_services" ADD CONSTRAINT "rental_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_services" ADD CONSTRAINT "rental_services_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_rentals" ADD CONSTRAINT "tenant_rentals_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_ticket_package_id_fkey" FOREIGN KEY ("ticket_package_id") REFERENCES "ticket_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_parking_service_id_fkey" FOREIGN KEY ("parking_service_id") REFERENCES "parking_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_rental_service_id_fkey" FOREIGN KEY ("rental_service_id") REFERENCES "rental_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_transactions" ADD CONSTRAINT "visitor_transactions_tenant_rental_id_fkey" FOREIGN KEY ("tenant_rental_id") REFERENCES "tenant_rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ar_account_id_fkey" FOREIGN KEY ("ar_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_ap_account_id_fkey" FOREIGN KEY ("ap_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_accounts" ADD CONSTRAINT "float_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_accounts" ADD CONSTRAINT "float_accounts_float_asset_account_id_fkey" FOREIGN KEY ("float_asset_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_accounts" ADD CONSTRAINT "float_accounts_offset_account_id_fkey" FOREIGN KEY ("offset_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_transactions" ADD CONSTRAINT "float_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_transactions" ADD CONSTRAINT "float_transactions_float_account_id_fkey" FOREIGN KEY ("float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_transactions" ADD CONSTRAINT "float_transactions_destination_float_account_id_fkey" FOREIGN KEY ("destination_float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_transactions" ADD CONSTRAINT "float_transactions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_balance_snapshots" ADD CONSTRAINT "float_balance_snapshots_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "float_balance_snapshots" ADD CONSTRAINT "float_balance_snapshots_float_account_id_fkey" FOREIGN KEY ("float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_account_id_fkey" FOREIGN KEY ("inventory_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_cogs_account_id_fkey" FOREIGN KEY ("cogs_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cost_histories" ADD CONSTRAINT "product_cost_histories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cost_histories" ADD CONSTRAINT "product_cost_histories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_float_account_id_fkey" FOREIGN KEY ("float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beginning_balances" ADD CONSTRAINT "beginning_balances_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beginning_balances" ADD CONSTRAINT "beginning_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_deposit_liability_account_id_fkey" FOREIGN KEY ("deposit_liability_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "customer_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_float_account_id_fkey" FOREIGN KEY ("float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_revenue_settlement_account_id_fkey" FOREIGN KEY ("revenue_settlement_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_ar_account_id_fkey" FOREIGN KEY ("ar_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "customer_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_float_account_id_fkey" FOREIGN KEY ("float_account_id") REFERENCES "float_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_ar_account_id_fkey" FOREIGN KEY ("ar_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawers" ADD CONSTRAINT "cash_drawers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawers" ADD CONSTRAINT "cash_drawers_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_drawer_id_fkey" FOREIGN KEY ("drawer_id") REFERENCES "cash_drawers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_destination_cash_account_id_fkey" FOREIGN KEY ("destination_cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_terminals" ADD CONSTRAINT "pos_terminals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "pos_terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_transactions" ADD CONSTRAINT "pos_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_transactions" ADD CONSTRAINT "pos_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cart_items" ADD CONSTRAINT "pos_cart_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cart_items" ADD CONSTRAINT "pos_cart_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "pos_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cart_items" ADD CONSTRAINT "pos_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_receipts" ADD CONSTRAINT "pos_receipts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_receipts" ADD CONSTRAINT "pos_receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "pos_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

