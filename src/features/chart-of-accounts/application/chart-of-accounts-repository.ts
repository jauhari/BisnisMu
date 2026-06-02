import {
  AccountNode,
  AccountTemplateItem,
  CreateAccountInput,
  TenantContext,
  UpdateAccountInput
} from "../domain/chart-of-accounts-types";

export interface ChartOfAccountsAuditEvent {
  action: "ACCOUNT_CREATED" | "ACCOUNT_UPDATED" | "ACCOUNT_DEACTIVATED" | "ACCOUNT_DELETED" | "CHART_OF_ACCOUNTS_SEEDED";
  businessId: string;
  actorUserId: string;
  entityType: "account" | "chart_of_accounts";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface ChartOfAccountsRepository {
  findById(ctx: TenantContext, accountId: string): Promise<AccountNode | null>;
  findByCode(ctx: TenantContext, code: string): Promise<AccountNode | null>;
  listAccounts(ctx: TenantContext): Promise<AccountNode[]>;
  createAccount(ctx: TenantContext, input: CreateAccountInput & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }): Promise<AccountNode>;
  updateAccount(ctx: TenantContext, input: UpdateAccountInput): Promise<AccountNode>;
  deleteAccount(ctx: TenantContext, accountId: string): Promise<void>;
  deactivateAccount(ctx: TenantContext, accountId: string): Promise<AccountNode>;
  countChildren(ctx: TenantContext, accountId: string): Promise<number>;
  countJournalLines(ctx: TenantContext, accountId: string): Promise<number>;
  createManySystemAccounts(ctx: TenantContext, accounts: Array<AccountTemplateItem & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }>): Promise<number>;
  createAuditLog(ctx: TenantContext, event: ChartOfAccountsAuditEvent): Promise<void>;
}

export interface CreateAccountCommand extends CreateAccountInput {
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateAccountCommand extends UpdateAccountInput {
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeleteAccountCommand {
  businessId: string;
  accountId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SeedChartOfAccountsCommand {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

