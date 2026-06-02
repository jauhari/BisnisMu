export interface TenantRequestContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export function toServiceContext(ctx: TenantRequestContext) { return { businessId: ctx.businessId, actorUserId: ctx.actorUserId, requestId: ctx.requestId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent }; }
export function assertTenantSelected(ctx: Partial<TenantRequestContext>): asserts ctx is TenantRequestContext { if (!ctx.businessId || !ctx.actorUserId) throw new Error("Tenant context requires businessId and actorUserId."); }
