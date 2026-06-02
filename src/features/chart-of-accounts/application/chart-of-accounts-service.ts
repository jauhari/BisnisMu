import { ChartOfAccountsEngine } from "../domain/chart-of-accounts-engine";
import { AccountTreeNode, TenantContext } from "../domain/chart-of-accounts-types";
import { expectedNormalBalanceForGroup, SAK_EMKM_STANDARD_ACCOUNTS } from "../domain/sak-emkm-rules";
import {
  ChartOfAccountsRepository,
  CreateAccountCommand,
  DeleteAccountCommand,
  SeedChartOfAccountsCommand,
  UpdateAccountCommand
} from "./chart-of-accounts-repository";

export class ChartOfAccountsService {
  constructor(
    private readonly repository: ChartOfAccountsRepository,
    private readonly engine = new ChartOfAccountsEngine()
  ) {}

  async list(ctx: TenantContext): Promise<AccountTreeNode[]> {
    return this.toTree(await this.repository.listAccounts(ctx));
  }

  async create(command: CreateAccountCommand) {
    const ctx = this.contextFrom(command);
    const [existing, parent] = await Promise.all([
      this.repository.findByCode(ctx, command.code),
      command.parentCode ? this.repository.findByCode(ctx, command.parentCode) : Promise.resolve(null)
    ]);

    const validated = this.engine.validateCreate(command, existing, parent);
    const created = await this.repository.createAccount(ctx, {
      ...validated,
      parentId: parent?.id ?? null
    });

    await this.repository.createAuditLog(ctx, {
      action: "ACCOUNT_CREATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "account",
      entityId: created.id,
      metadata: { code: created.code, name: created.name, groupCode: created.groupCode, isSystem: created.isSystem }
    });

    return created;
  }

  async update(command: UpdateAccountCommand) {
    const ctx = this.contextFrom(command);
    const account = await this.repository.findById(ctx, command.accountId);
    this.engine.validateUpdate(command, account);

    const updated = await this.repository.updateAccount(ctx, command);
    await this.repository.createAuditLog(ctx, {
      action: "ACCOUNT_UPDATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "account",
      entityId: updated.id,
      metadata: { code: updated.code, name: updated.name, isActive: updated.isActive }
    });

    return updated;
  }

  async delete(command: DeleteAccountCommand): Promise<{ action: "DELETED" | "DEACTIVATED" }> {
    const ctx = this.contextFrom(command);
    const [account, childCount, journalLineCount] = await Promise.all([
      this.repository.findById(ctx, command.accountId),
      this.repository.countChildren(ctx, command.accountId),
      this.repository.countJournalLines(ctx, command.accountId)
    ]);

    const action = this.engine.validateDelete(account, childCount, journalLineCount);

    if (action === "DELETE") {
      await this.repository.deleteAccount(ctx, command.accountId);
      await this.repository.createAuditLog(ctx, {
        action: "ACCOUNT_DELETED",
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        entityType: "account",
        entityId: command.accountId,
        metadata: { code: account?.code, name: account?.name }
      });
      return { action: "DELETED" };
    }

    const deactivated = await this.repository.deactivateAccount(ctx, command.accountId);
    await this.repository.createAuditLog(ctx, {
      action: "ACCOUNT_DEACTIVATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "account",
      entityId: deactivated.id,
      metadata: { code: deactivated.code, name: deactivated.name, reason: "HAS_JOURNAL_LINES" }
    });

    return { action: "DEACTIVATED" };
  }

  async seedSakEmkm(command: SeedChartOfAccountsCommand): Promise<{ created: number }> {
    const ctx = this.contextFrom(command);
    const existingAccounts = await this.repository.listAccounts(ctx);
    const existingCodes = new Set(existingAccounts.map((account) => account.code));
    const existingByCode = new Map(existingAccounts.map((account) => [account.code, account]));
    const pendingByCode = new Map<string, { id?: string | null }>();

    const toCreate = [];
    for (const item of SAK_EMKM_STANDARD_ACCOUNTS) {
      if (existingCodes.has(item.code)) continue;

      const normalBalance = expectedNormalBalanceForGroup(item.groupCode);
      this.engine.assertTemplateItem({ businessId: ctx.businessId, normalBalance, ...item });

      const parentId = item.parentCode ? existingByCode.get(item.parentCode)?.id ?? pendingByCode.get(item.parentCode)?.id ?? null : null;
      toCreate.push({ ...item, normalBalance, parentId });
      pendingByCode.set(item.code, { id: null });
    }

    const created = await this.repository.createManySystemAccounts(ctx, toCreate);
    await this.repository.createAuditLog(ctx, {
      action: "CHART_OF_ACCOUNTS_SEEDED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "chart_of_accounts",
      metadata: { standard: "SAK_EMKM", created }
    });

    return { created };
  }

  private toTree(accounts: Awaited<ReturnType<ChartOfAccountsRepository["listAccounts"]>>): AccountTreeNode[] {
    const nodes = new Map(accounts.map((account) => [account.id, { ...account, children: [] as AccountTreeNode[] }]));
    const roots: AccountTreeNode[] = [];

    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRecursive = (items: AccountTreeNode[]) => {
      items.sort((a, b) => a.code.localeCompare(b.code));
      items.forEach((item) => sortRecursive(item.children));
    };
    sortRecursive(roots);
    return roots;
  }

  private contextFrom(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }
}

