export type TourismRentalType = "GAZEBO" | "AREA" | "EVENT";
export type VisitorTransactionSource = "ENTRANCE_TICKET" | "PACKAGE_TICKET" | "PARKING_FEE" | "GAZEBO_RENTAL" | "AREA_RENTAL" | "TENANT_RENTAL" | "EVENT_RENTAL";
export type VisitorTransactionStatus = "DRAFT" | "PAID" | "VOID";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface Attraction { id: string; businessId: string; name: string; description?: string | null; location?: string | null; visitorLimit?: number | null; isActive: boolean; startsOn?: Date | null; endsOn?: Date | null; }
export interface TicketType { id: string; businessId: string; attractionId: string; name: string; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint | null; seasonalPrice?: bigint | null; seasonalStartsOn?: Date | null; seasonalEndsOn?: Date | null; visitorLimit?: number | null; isActive: boolean; startsOn?: Date | null; endsOn?: Date | null; }
export interface TicketPackage { id: string; businessId: string; attractionId: string; name: string; revenueCategoryId: string; packagePrice: bigint; maxVisitors?: number | null; isActive: boolean; startsOn?: Date | null; endsOn?: Date | null; }
export interface ParkingService { id: string; businessId: string; attractionId: string; name: string; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint | null; isActive: boolean; }
export interface RentalService { id: string; businessId: string; attractionId: string; name: string; type: TourismRentalType; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint | null; seasonalPrice?: bigint | null; seasonalStartsOn?: Date | null; seasonalEndsOn?: Date | null; isActive: boolean; }
export interface TenantRental { id: string; businessId: string; attractionId: string; tenantName: string; revenueCategoryId: string; rentalPrice: bigint; isActive: boolean; }

export interface VisitorTransaction {
  id: string; businessId: string; transactionNumber: string; status: VisitorTransactionStatus; source: VisitorTransactionSource; transactionDate: Date; attractionId: string;
  ticketTypeId?: string | null; ticketPackageId?: string | null; parkingServiceId?: string | null; rentalServiceId?: string | null; tenantRentalId?: string | null;
  cashAccountId: string; quantity: number; visitorCount: number; unitPrice: bigint; amount: bigint; validationCode: string; receiptNumber: string; qrPayload?: Record<string, unknown> | null; bookingReference?: string | null; revenueTransactionId?: string | null; voidReason?: string | null; createdByUserId: string;
}

export interface CreateAttractionInput { businessId: string; name: string; description?: string; location?: string; visitorLimit?: number; startsOn?: Date; endsOn?: Date; }
export interface CreateTicketTypeInput { businessId: string; attractionId: string; name: string; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint; seasonalPrice?: bigint; seasonalStartsOn?: Date; seasonalEndsOn?: Date; visitorLimit?: number; startsOn?: Date; endsOn?: Date; }
export interface CreateTicketPackageInput { businessId: string; attractionId: string; name: string; revenueCategoryId: string; packagePrice: bigint; maxVisitors?: number; startsOn?: Date; endsOn?: Date; }
export interface CreateParkingServiceInput { businessId: string; attractionId: string; name: string; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint; }
export interface CreateRentalServiceInput { businessId: string; attractionId: string; name: string; type: TourismRentalType; revenueCategoryId: string; dailyPrice: bigint; weekendPrice?: bigint; seasonalPrice?: bigint; seasonalStartsOn?: Date; seasonalEndsOn?: Date; }
export interface CreateTenantRentalInput { businessId: string; attractionId: string; tenantName: string; revenueCategoryId: string; rentalPrice: bigint; }
export interface CreateVisitorTransactionInput { businessId: string; source: VisitorTransactionSource; transactionDate: Date; attractionId: string; ticketTypeId?: string; ticketPackageId?: string; parkingServiceId?: string; rentalServiceId?: string; tenantRentalId?: string; cashAccountId: string; quantity?: number; visitorCount?: number; bookingReference?: string; }

export interface TourismPricingContext { attraction: Attraction | null; ticketType?: TicketType | null; ticketPackage?: TicketPackage | null; parkingService?: ParkingService | null; rentalService?: RentalService | null; tenantRental?: TenantRental | null; usedVisitors: number; }
export interface TourismPricingResult { revenueCategoryId: string; revenueType: "TICKET" | "PACKAGE" | "PARKING" | "RENTAL" | "TENANT_RENT"; unitPrice: bigint; amount: bigint; quantity: number; visitorCount: number; }
export interface TicketValidationResult { valid: boolean; reason?: string; transaction?: VisitorTransaction; }
export class TourismError extends Error { constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "TourismError"; } }

