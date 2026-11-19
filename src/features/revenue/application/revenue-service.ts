import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { RevenueEngine } from "../domain/revenue-engine";
import { RevenueDraftInput, RevenueError, RevenueValidationContext, TenantContext } from "../domain/revenue-types";
import { CreateRevenueCategoryCommand, CreateRevenueDraftCommand, CreateRevenueItemCommand, CreateRevenuePackageCommand, CreateRevenuePricingCommand, PostRevenueCommand, RevenueRepository, VoidRevenueCommand } from "./revenue-repository";
import { inlineTransactionRunner, type TransactionRunner } from "../../shared/transaction-runner";

export class RevenueService {
  constructor(private readonly repository: RevenueRepository, private readonly journalPostingService: JournalPostingService, private readonly engine = new RevenueEngine(), private readonly txRunner: TransactionRunner = inlineTransactionRunner) {}

  async createCategory(command: CreateRevenueCategoryCommand) {
    const ctx = this.contextFrom(command);
    this.engine.validateCategoryAccount(await this.repository.findAccount(ctx, command.revenueAccountId), ctx.businessId);
    const category = await this.repository.createCategory(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "REVENUE_CATEGORY_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_category", entityId: category.id, metadata: { name: category.name, type: category.type } });
    return category;
  }

  async createItem(command: CreateRevenueItemCommand) {
    const ctx = this.contextFrom(command);
    const category = await this.repository.findCategory(ctx, command.categoryId);
    if (!category || !category.isActive) throw new RevenueError("CATEGORY_NOT_AVAILABLE", "Revenue category is not available.");
    const item = await this.repository.createItem(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "REVENUE_ITEM_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_item", entityId: item.id, metadata: { name: item.name, categoryId: item.categoryId } });
    return item;
  }

  async createPackage(command: CreateRevenuePackageCommand) {
    const ctx = this.contextFrom(command);
    const category = await this.repository.findCategory(ctx, command.categoryId);
    if (!category || !category.isActive) throw new RevenueError("CATEGORY_NOT_AVAILABLE", "Revenue category is not available.");
    const pkg = await this.repository.createPackage(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "REVENUE_PACKAGE_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_package", entityId: pkg.id, metadata: { name: pkg.name, categoryId: pkg.categoryId } });
    return pkg;
  }

  async createPricing(command: CreateRevenuePricingCommand) {
    const ctx = this.contextFrom(command);
    if ((command.itemId ? 1 : 0) + (command.packageId ? 1 : 0) !== 1) throw new RevenueError("PRICING_TARGET_INVALID", "Pricing must target exactly one item or package.");
    if (command.amount <= 0n) throw new RevenueError("INVALID_PRICE", "Pricing amount must be greater than zero.");
    const pricing = await this.repository.createPricing(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "REVENUE_PRICING_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_pricing", entityId: pricing.id, metadata: { type: pricing.type, amount: pricing.amount.toString() } });
    return pricing;
  }

  async preview(command: CreateRevenueDraftCommand) {
    const ctx = this.contextFrom(command);
    return this.engine.preview(command, await this.validationContext(ctx, command));
  }

  async createDraft(command: CreateRevenueDraftCommand) {
    const ctx = this.contextFrom(command);
    const preview = this.engine.preview(command, await this.validationContext(ctx, command));
    const transactionNumber = await this.repository.nextTransactionNumber(ctx, command.transactionDate);
    const draftInput = { ...command, unitPrice: preview.unitPrice, amount: preview.amount };
    if (preview.pricingId !== undefined && preview.pricingId !== null) draftInput.pricingId = preview.pricingId;
    const draft = await this.repository.createDraft(ctx, draftInput, transactionNumber);
    await this.repository.createAuditLog(ctx, { action: "REVENUE_TRANSACTION_DRAFTED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_transaction", entityId: draft.id, metadata: { transactionNumber, type: draft.type, amount: draft.amount.toString() } });
    return draft;
  }

  async post(command: PostRevenueCommand) {
    const ctx = this.contextFrom(command);
    const tx = await this.requireTransaction(ctx, command.transactionId);
    if (tx.status !== "DRAFT") throw new RevenueError("ONLY_DRAFT_CAN_BE_POSTED", "Only draft revenue transactions can be posted.");
    const category = await this.repository.findCategory(ctx, tx.categoryId);
    if (!category) throw new RevenueError("CATEGORY_NOT_AVAILABLE", "Revenue category is not available.");
    const postCommand: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: tx.transactionDate, source: "REVENUE_" + tx.type, sourceId: tx.id, description: tx.description, idempotencyKey: "revenue:" + ctx.businessId + ":" + tx.id, lines: [{ accountId: tx.cashAccountId, side: "DEBIT", amount: tx.amount }, { accountId: category.revenueAccountId, side: "CREDIT", amount: tx.amount }] };
    this.copyMeta(ctx, postCommand);
    // Journal + status flip commit atomically; a failure after posting must not
    // leave a posted journal with the transaction still in DRAFT.
    const { journal, posted } = await this.txRunner.run(async (dbTx) => {
      const journal = await this.journalPostingService.post(postCommand, dbTx);
      const posted = await this.repository.markPosted(ctx, tx.id, journal.journalId, dbTx);
      return { journal, posted };
    });
    await this.auditSafe(ctx, { action: "REVENUE_TRANSACTION_POSTED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_transaction", entityId: posted.id, metadata: { journalId: journal.journalId, transactionNumber: posted.transactionNumber } });
    return { transaction: posted, journal };
  }

  async void(command: VoidRevenueCommand) {
    const ctx = this.contextFrom(command);
    if (command.reason.trim().length < 10) throw new RevenueError("VOID_REASON_TOO_SHORT", "Void reason must be at least 10 characters.");
    const tx = await this.requireTransaction(ctx, command.transactionId);
    if (tx.status !== "POSTED") throw new RevenueError("ONLY_POSTED_CAN_BE_VOIDED", "Only posted revenue transactions can be voided.");
    const category = await this.repository.findCategory(ctx, tx.categoryId);
    if (!category) throw new RevenueError("CATEGORY_NOT_AVAILABLE", "Revenue category is not available.");
    const postCommand: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: tx.transactionDate, source: "VOID_REVENUE_TRANSACTION", sourceId: tx.id, description: "Void " + tx.transactionNumber + ": " + command.reason.trim(), idempotencyKey: "void-revenue:" + ctx.businessId + ":" + tx.id, lines: this.engine.buildVoidLines(tx, category.revenueAccountId) };
    this.copyMeta(ctx, postCommand);
    const { journal, voided } = await this.txRunner.run(async (dbTx) => {
      const journal = await this.journalPostingService.post(postCommand, dbTx);
      const voided = await this.repository.markVoided(ctx, tx.id, journal.journalId, command.reason.trim(), dbTx);
      return { journal, voided };
    });
    await this.auditSafe(ctx, { action: "REVENUE_TRANSACTION_VOIDED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "revenue_transaction", entityId: voided.id, metadata: { voidJournalId: journal.journalId, reason: command.reason.trim() } });
    return { transaction: voided, journal };
  }

  private async validationContext(ctx: TenantContext, input: RevenueDraftInput): Promise<RevenueValidationContext> {
    const category = await this.repository.findCategory(ctx, input.categoryId);
    const [item, pkg, pricing, cashAccount, revenueAccount, availablePricings] = await Promise.all([
      input.itemId ? this.repository.findItem(ctx, input.itemId) : Promise.resolve(null),
      input.packageId ? this.repository.findPackage(ctx, input.packageId) : Promise.resolve(null),
      input.pricingId ? this.repository.findPricing(ctx, input.pricingId) : Promise.resolve(null),
      this.repository.findAccount(ctx, input.cashAccountId),
      category ? this.repository.findAccount(ctx, category.revenueAccountId) : Promise.resolve(null),
      this.repository.listPricings(ctx, this.pricingLookup(input))
    ]);
    return { category, item, package: pkg, pricing, cashAccount, revenueAccount, availablePricings };
  }

  private pricingLookup(input: RevenueDraftInput): { itemId?: string; packageId?: string } {
    const lookup: { itemId?: string; packageId?: string } = {};
    if (input.itemId !== undefined) lookup.itemId = input.itemId;
    if (input.packageId !== undefined) lookup.packageId = input.packageId;
    return lookup;
  }

  private async requireTransaction(ctx: TenantContext, id: string) {
    const tx = await this.repository.findTransaction(ctx, id);
    if (!tx) throw new RevenueError("REVENUE_TRANSACTION_NOT_FOUND", "Revenue transaction was not found.");
    return tx;
  }

  private copyMeta(ctx: TenantContext, command: PostJournalCommand): void {
    if (ctx.requestId !== undefined) command.requestId = ctx.requestId;
    if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress;
    if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent;
  }

  /** Audit logging is best-effort: it must never roll back or mask a committed posting. */
  private async auditSafe(ctx: TenantContext, event: Parameters<RevenueRepository["createAuditLog"]>[1]): Promise<void> {
    try {
      await this.repository.createAuditLog(ctx, event);
    } catch (error) {
      console.error("[revenue] failed to write audit log", error);
    }
  }

  private contextFrom(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }
}

