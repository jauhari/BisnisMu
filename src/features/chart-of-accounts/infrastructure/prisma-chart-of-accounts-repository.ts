import { Prisma, PrismaClient } from "@prisma/client";
import {
  AccountGroupCode,
  AccountNode,
  AccountTemplateItem,
  CreateAccountInput,
  TenantContext,
  UpdateAccountInput
} from "../domain/chart-of-accounts-types";
import { ChartOfAccountsAuditEvent, ChartOfAccountsRepository } from "../application/chart-of-accounts-repository";

const prismaGroupByDomain = {
  1: "ASSET",
  2: "LIABILITY",
  3: "EQUITY",
  4: "REVENUE",
  5: "COGS",
  6: "EXPENSE",
  7: "OTHER_EXPENSE"
} as const;

const domainGroupByPrisma = {
  ASSET: 1,
  LIABILITY: 2,
  EQUITY: 3,
  REVENUE: 4,
  COGS: 5,
  EXPENSE: 6,
  OTHER_EXPENSE: 7
} as const;

type PrismaAccount = Awaited<ReturnType<PrismaClient["account"]["findFirst"]>>;

export class PrismaChartOfAccountsRepository implements ChartOfAccountsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(ctx: TenantContext, accountId: string): Promise<AccountNode | null> {
    const account = await this.prisma.account.findFirst({ where: { businessId: ctx.businessId, id: accountId } });
    return account ? this.toDomain(account) : null;
  }

  async findByCode(ctx: TenantContext, code: string): Promise<AccountNode | null> {
    const account = await this.prisma.account.findFirst({ where: { businessId: ctx.businessId, code } });
    return account ? this.toDomain(account) : null;
  }

  async listAccounts(ctx: TenantContext): Promise<AccountNode[]> {
    const accounts = await this.prisma.account.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { code: "asc" }
    });
    return accounts.map((account) => this.toDomain(account));
  }

  async createAccount(ctx: TenantContext, input: CreateAccountInput & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }): Promise<AccountNode> {
    const account = await this.prisma.account.create({
      data: this.toCreateData(ctx, input)
    });
    return this.toDomain(account);
  }

  async updateAccount(ctx: TenantContext, input: UpdateAccountInput): Promise<AccountNode> {
    const data: Prisma.AccountUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.subtype !== undefined) data.subtype = input.subtype;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const account = await this.prisma.account.update({
      where: { id: input.accountId, businessId: ctx.businessId },
      data
    });
    return this.toDomain(account);
  }

  async deleteAccount(ctx: TenantContext, accountId: string): Promise<void> {
    await this.prisma.account.delete({ where: { id: accountId, businessId: ctx.businessId } });
  }

  async deactivateAccount(ctx: TenantContext, accountId: string): Promise<AccountNode> {
    const account = await this.prisma.account.update({
      where: { id: accountId, businessId: ctx.businessId },
      data: { isActive: false }
    });
    return this.toDomain(account);
  }

  async countChildren(ctx: TenantContext, accountId: string): Promise<number> {
    return this.prisma.account.count({ where: { businessId: ctx.businessId, parentId: accountId } });
  }

  async countJournalLines(ctx: TenantContext, accountId: string): Promise<number> {
    return this.prisma.journalLine.count({ where: { businessId: ctx.businessId, accountId } });
  }

  async createManySystemAccounts(ctx: TenantContext, accounts: Array<AccountTemplateItem & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }>): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // Fetch all existing accounts once instead of one findFirst per template
      // account (removes ~N queries from chart-of-accounts seeding).
      const existingAccounts = await tx.account.findMany({
        where: { businessId: ctx.businessId, code: { in: accounts.map((a) => a.code) } },
        select: { id: true, code: true },
      });
      const createdByCode = new Map<string, string>(existingAccounts.map((a) => [a.code, a.id]));
      let created = 0;

      for (const account of accounts) {
        if (createdByCode.has(account.code)) continue;
        const parentId = account.parentCode ? createdByCode.get(account.parentCode) ?? account.parentId ?? null : null;
        const row = await tx.account.create({
          data: this.toCreateData(ctx, { ...account, parentId })
        });
        createdByCode.set(row.code, row.id);
        created += 1;
      }

      return created;
    });
  }

  async createAuditLog(ctx: TenantContext, event: ChartOfAccountsAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata as Prisma.InputJsonValue,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null
      }
    });
  }

  private toCreateData(ctx: TenantContext, input: Omit<CreateAccountInput, "businessId"> & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }): Prisma.AccountUncheckedCreateInput {
    return {
      businessId: ctx.businessId,
      code: input.code,
      name: input.name.trim(),
      groupCode: prismaGroupByDomain[input.groupCode],
      subtype: input.subtype ?? null,
      description: input.description ?? null,
      normalBalance: input.normalBalance,
      parentId: input.parentId ?? null,
      parentCode: input.parentCode ?? null,
      isSystem: input.isSystem ?? false,
      isPostingAllowed: input.isPostingAllowed ?? true,
      isActive: true
    };
  }

  private toDomain(account: NonNullable<PrismaAccount>): AccountNode {
    return {
      id: account.id,
      businessId: account.businessId,
      code: account.code,
      name: account.name,
      groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode,
      subtype: account.subtype,
      description: account.description,
      normalBalance: account.normalBalance,
      parentId: account.parentId,
      parentCode: account.parentCode,
      isSystem: account.isSystem,
      isPostingAllowed: account.isPostingAllowed,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }
}

