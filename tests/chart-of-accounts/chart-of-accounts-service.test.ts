import { describe, expect, it } from "vitest";
import { ChartOfAccountsRepository, ChartOfAccountsAuditEvent } from "../../src/features/chart-of-accounts/application/chart-of-accounts-repository";
import { ChartOfAccountsService } from "../../src/features/chart-of-accounts/application/chart-of-accounts-service";
import { AccountNode, AccountTemplateItem, CreateAccountInput, TenantContext, UpdateAccountInput } from "../../src/features/chart-of-accounts/domain/chart-of-accounts-types";
import { SAK_EMKM_STANDARD_ACCOUNTS } from "../../src/features/chart-of-accounts/domain/sak-emkm-rules";

class InMemoryCoaRepository implements ChartOfAccountsRepository {
  accounts = new Map<string, AccountNode>();
  auditEvents: ChartOfAccountsAuditEvent[] = [];
  journalLineCounts = new Map<string, number>();
  private sequence = 1;

  async findById(ctx: TenantContext, accountId: string): Promise<AccountNode | null> {
    const account = this.accounts.get(accountId) ?? null;
    return account?.businessId === ctx.businessId ? account : null;
  }

  async findByCode(ctx: TenantContext, code: string): Promise<AccountNode | null> {
    return [...this.accounts.values()].find((account) => account.businessId === ctx.businessId && account.code === code) ?? null;
  }

  async listAccounts(ctx: TenantContext): Promise<AccountNode[]> {
    return [...this.accounts.values()].filter((account) => account.businessId === ctx.businessId).sort((a, b) => a.code.localeCompare(b.code));
  }

  async createAccount(ctx: TenantContext, input: CreateAccountInput & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }): Promise<AccountNode> {
    const account: AccountNode = {
      id: "account-" + this.sequence++,
      businessId: ctx.businessId,
      code: input.code,
      name: input.name.trim(),
      groupCode: input.groupCode,
      subtype: input.subtype ?? null,
      description: input.description ?? null,
      normalBalance: input.normalBalance,
      parentId: input.parentId ?? null,
      parentCode: input.parentCode ?? null,
      isSystem: input.isSystem ?? false,
      isPostingAllowed: input.isPostingAllowed ?? true,
      isActive: true
    };
    this.accounts.set(account.id, account);
    return account;
  }

  async updateAccount(ctx: TenantContext, input: UpdateAccountInput): Promise<AccountNode> {
    const account = await this.findById(ctx, input.accountId);
    if (!account) throw new Error("not found");
    const updated = { ...account };
    if (input.name !== undefined) updated.name = input.name.trim();
    if (input.description !== undefined) updated.description = input.description;
    if (input.subtype !== undefined) updated.subtype = input.subtype;
    if (input.isActive !== undefined) updated.isActive = input.isActive;
    this.accounts.set(updated.id, updated);
    return updated;
  }

  async deleteAccount(ctx: TenantContext, accountId: string): Promise<void> {
    const account = await this.findById(ctx, accountId);
    if (account) this.accounts.delete(account.id);
  }

  async deactivateAccount(ctx: TenantContext, accountId: string): Promise<AccountNode> {
    return this.updateAccount(ctx, { businessId: ctx.businessId, accountId, isActive: false });
  }

  async countChildren(ctx: TenantContext, accountId: string): Promise<number> {
    return [...this.accounts.values()].filter((account) => account.businessId === ctx.businessId && account.parentId === accountId).length;
  }

  async countJournalLines(ctx: TenantContext, accountId: string): Promise<number> {
    return this.journalLineCounts.get(ctx.businessId + ":" + accountId) ?? 0;
  }

  async createManySystemAccounts(ctx: TenantContext, accounts: Array<AccountTemplateItem & { normalBalance: "DEBIT" | "CREDIT"; parentId?: string | null }>): Promise<number> {
    let created = 0;
    const createdByCode = new Map<string, string>();
    for (const item of accounts) {
      if (await this.findByCode(ctx, item.code)) continue;
      const parentId = item.parentCode ? createdByCode.get(item.parentCode) ?? item.parentId ?? null : null;
      const account = await this.createAccount(ctx, { ...item, businessId: ctx.businessId, parentId });
      createdByCode.set(account.code, account.id);
      created += 1;
    }
    return created;
  }

  async createAuditLog(_ctx: TenantContext, event: ChartOfAccountsAuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }
}

const ctx = { businessId: "biz-1", actorUserId: "user-1" };

describe("ChartOfAccountsService", () => {
  it("seeds the full SAK EMKM chart of accounts idempotently", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);

    const first = await service.seedSakEmkm(ctx);
    const second = await service.seedSakEmkm(ctx);
    const accounts = await repo.listAccounts(ctx);

    expect(first.created).toBe(SAK_EMKM_STANDARD_ACCOUNTS.length);
    expect(second.created).toBe(0);
    expect(accounts).toHaveLength(SAK_EMKM_STANDARD_ACCOUNTS.length);
    expect(accounts.find((account) => account.code === "110101")?.normalBalance).toBe("DEBIT");
    expect(accounts.find((account) => account.code === "210101")?.normalBalance).toBe("CREDIT");
    expect(repo.auditEvents.at(-1)?.action).toBe("CHART_OF_ACCOUNTS_SEEDED");
  });

  it("creates a custom account under the correct parent hierarchy", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);
    await service.seedSakEmkm(ctx);

    const account = await service.create({
      ...ctx,
      code: "110501",
      name: "Deposit Sewa",
      groupCode: 1,
      parentCode: "110000"
    });

    expect(account.normalBalance).toBe("DEBIT");
    expect(account.parentCode).toBe("110000");
    expect(account.isSystem).toBe(false);
  });

  it("rejects account codes that conflict with account group", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);

    await expect(service.create({ ...ctx, code: "610901", name: "Salah Grup", groupCode: 1 })).rejects.toThrow(/prefix must match/i);
  });

  it("rejects normal balance that conflicts with SAK EMKM group rules", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);

    await expect(service.create({ ...ctx, code: "410901", name: "Pendapatan Salah", groupCode: 4, normalBalance: "DEBIT" })).rejects.toThrow(/normal balance/i);
  });

  it("prevents deleting system accounts", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);
    await service.seedSakEmkm(ctx);
    const cash = await repo.findByCode(ctx, "110101");

    await expect(service.delete({ ...ctx, accountId: cash!.id })).rejects.toThrow(/system accounts cannot be deleted/i);
  });

  it("deactivates custom accounts with journal history instead of deleting them", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);
    await service.seedSakEmkm(ctx);
    const account = await service.create({ ...ctx, code: "610901", name: "Beban Internet", groupCode: 6, parentCode: "600000" });
    repo.journalLineCounts.set(ctx.businessId + ":" + account.id, 2);

    const result = await service.delete({ ...ctx, accountId: account.id });
    const updated = await repo.findById(ctx, account.id);

    expect(result.action).toBe("DEACTIVATED");
    expect(updated?.isActive).toBe(false);
  });

  it("does not expose accounts from another tenant", async () => {
    const repo = new InMemoryCoaRepository();
    const service = new ChartOfAccountsService(repo);
    await service.create({ ...ctx, code: "110501", name: "Deposit Sewa", groupCode: 1 });
    await service.create({ businessId: "biz-2", actorUserId: "user-2", code: "110501", name: "Tenant Lain", groupCode: 1 });

    const accounts = await service.list(ctx);

    expect(accounts.flatMap((account) => [account.name, ...account.children.map((child) => child.name)])).not.toContain("Tenant Lain");
  });
});

