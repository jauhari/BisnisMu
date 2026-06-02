import { Attraction, CreateAttractionInput, CreateParkingServiceInput, CreateRentalServiceInput, CreateTenantRentalInput, CreateTicketPackageInput, CreateTicketTypeInput, CreateVisitorTransactionInput, ParkingService, RentalService, TenantContext, TenantRental, TicketPackage, TicketType, VisitorTransaction } from "../domain/tourism-types";

export interface TourismAuditEvent { action: "ATTRACTION_CREATED" | "TICKET_TYPE_CREATED" | "TICKET_PACKAGE_CREATED" | "PARKING_SERVICE_CREATED" | "RENTAL_SERVICE_CREATED" | "TENANT_RENTAL_CREATED" | "VISITOR_TRANSACTION_DRAFTED" | "VISITOR_TRANSACTION_PAID" | "VISITOR_TRANSACTION_VOIDED" | "TICKET_VALIDATED"; businessId: string; actorUserId: string; entityType: "attraction" | "ticket_type" | "ticket_package" | "parking_service" | "rental_service" | "tenant_rental" | "visitor_transaction"; entityId?: string; metadata: Record<string, unknown>; }
export interface TourismRepository {
  createAttraction(ctx: TenantContext, input: CreateAttractionInput): Promise<Attraction>;
  createTicketType(ctx: TenantContext, input: CreateTicketTypeInput): Promise<TicketType>;
  createTicketPackage(ctx: TenantContext, input: CreateTicketPackageInput): Promise<TicketPackage>;
  createParkingService(ctx: TenantContext, input: CreateParkingServiceInput): Promise<ParkingService>;
  createRentalService(ctx: TenantContext, input: CreateRentalServiceInput): Promise<RentalService>;
  createTenantRental(ctx: TenantContext, input: CreateTenantRentalInput): Promise<TenantRental>;
  findAttraction(ctx: TenantContext, id: string): Promise<Attraction | null>;
  findTicketType(ctx: TenantContext, id: string): Promise<TicketType | null>;
  findTicketPackage(ctx: TenantContext, id: string): Promise<TicketPackage | null>;
  findParkingService(ctx: TenantContext, id: string): Promise<ParkingService | null>;
  findRentalService(ctx: TenantContext, id: string): Promise<RentalService | null>;
  findTenantRental(ctx: TenantContext, id: string): Promise<TenantRental | null>;
  countVisitors(ctx: TenantContext, attractionId: string, date: Date): Promise<number>;
  nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string>;
  createVisitorTransaction(ctx: TenantContext, input: CreateVisitorTransactionInput & { transactionNumber: string; unitPrice: bigint; amount: bigint; quantity: number; visitorCount: number; validationCode: string; receiptNumber: string; revenueCategoryId: string; qrPayload: Record<string, unknown> }): Promise<VisitorTransaction>;
  findVisitorTransaction(ctx: TenantContext, id: string): Promise<VisitorTransaction | null>;
  findVisitorTransactionByValidationCode(ctx: TenantContext, code: string): Promise<VisitorTransaction | null>;
  markPaid(ctx: TenantContext, id: string, revenueTransactionId: string): Promise<VisitorTransaction>;
  markVoided(ctx: TenantContext, id: string, reason: string): Promise<VisitorTransaction>;
  createAuditLog(ctx: TenantContext, event: TourismAuditEvent): Promise<void>;
}
export interface TourismCommandMeta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateAttractionCommand extends CreateAttractionInput, TourismCommandMeta {}
export interface CreateTicketTypeCommand extends CreateTicketTypeInput, TourismCommandMeta {}
export interface CreateTicketPackageCommand extends CreateTicketPackageInput, TourismCommandMeta {}
export interface CreateParkingServiceCommand extends CreateParkingServiceInput, TourismCommandMeta {}
export interface CreateRentalServiceCommand extends CreateRentalServiceInput, TourismCommandMeta {}
export interface CreateTenantRentalCommand extends CreateTenantRentalInput, TourismCommandMeta {}
export interface CreateVisitorTransactionCommand extends CreateVisitorTransactionInput, TourismCommandMeta {}
export interface ValidateTicketCommand { businessId: string; validationCode: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface VoidVisitorTransactionCommand { businessId: string; visitorTransactionId: string; reason: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

