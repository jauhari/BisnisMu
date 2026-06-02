import { CreateVisitorTransactionInput, TicketValidationResult, TourismError, TourismPricingContext, TourismPricingResult, VisitorTransaction } from "./tourism-types";

export class TourismEngine {
  price(input: CreateVisitorTransactionInput, context: TourismPricingContext): TourismPricingResult {
    this.assertAttraction(input, context);
    const quantity = input.quantity ?? 1;
    const visitorCount = input.visitorCount ?? quantity;
    if (!Number.isInteger(quantity) || quantity <= 0) throw new TourismError("INVALID_QUANTITY", "Quantity must be positive.");
    if (!Number.isInteger(visitorCount) || visitorCount <= 0) throw new TourismError("INVALID_VISITOR_COUNT", "Visitor count must be positive.");

    if (input.source === "ENTRANCE_TICKET") {
      const ticket = context.ticketType;
      if (!ticket || ticket.businessId !== input.businessId || ticket.attractionId !== input.attractionId || !ticket.isActive) throw new TourismError("TICKET_TYPE_NOT_AVAILABLE", "Ticket type is not available.");
      this.assertSchedule(ticket, input.transactionDate);
      this.assertVisitorLimit(ticket.visitorLimit ?? context.attraction?.visitorLimit ?? null, context.usedVisitors, visitorCount);
      const unitPrice = this.scheduledPrice(input.transactionDate, ticket.dailyPrice, ticket.weekendPrice, ticket.seasonalPrice, ticket.seasonalStartsOn, ticket.seasonalEndsOn);
      return { revenueCategoryId: ticket.revenueCategoryId, revenueType: "TICKET", unitPrice, amount: unitPrice * BigInt(quantity), quantity, visitorCount };
    }
    if (input.source === "PACKAGE_TICKET") {
      const pkg = context.ticketPackage;
      if (!pkg || pkg.businessId !== input.businessId || pkg.attractionId !== input.attractionId || !pkg.isActive) throw new TourismError("TICKET_PACKAGE_NOT_AVAILABLE", "Ticket package is not available.");
      this.assertSchedule(pkg, input.transactionDate);
      this.assertVisitorLimit(pkg.maxVisitors ?? context.attraction?.visitorLimit ?? null, context.usedVisitors, visitorCount);
      return { revenueCategoryId: pkg.revenueCategoryId, revenueType: "PACKAGE", unitPrice: pkg.packagePrice, amount: pkg.packagePrice * BigInt(quantity), quantity, visitorCount };
    }
    if (input.source === "PARKING_FEE") {
      const parking = context.parkingService;
      if (!parking || parking.businessId !== input.businessId || parking.attractionId !== input.attractionId || !parking.isActive) throw new TourismError("PARKING_SERVICE_NOT_AVAILABLE", "Parking service is not available.");
      const unitPrice = this.weekendAwarePrice(input.transactionDate, parking.dailyPrice, parking.weekendPrice);
      return { revenueCategoryId: parking.revenueCategoryId, revenueType: "PARKING", unitPrice, amount: unitPrice * BigInt(quantity), quantity, visitorCount };
    }
    if (["GAZEBO_RENTAL", "AREA_RENTAL", "EVENT_RENTAL"].includes(input.source)) {
      const rental = context.rentalService;
      if (!rental || rental.businessId !== input.businessId || rental.attractionId !== input.attractionId || !rental.isActive) throw new TourismError("RENTAL_SERVICE_NOT_AVAILABLE", "Rental service is not available.");
      const expected = input.source === "GAZEBO_RENTAL" ? "GAZEBO" : input.source === "AREA_RENTAL" ? "AREA" : "EVENT";
      if (rental.type !== expected) throw new TourismError("RENTAL_TYPE_MISMATCH", "Rental service type does not match transaction source.");
      const unitPrice = this.scheduledPrice(input.transactionDate, rental.dailyPrice, rental.weekendPrice, rental.seasonalPrice, rental.seasonalStartsOn, rental.seasonalEndsOn);
      return { revenueCategoryId: rental.revenueCategoryId, revenueType: "RENTAL", unitPrice, amount: unitPrice * BigInt(quantity), quantity, visitorCount };
    }
    const tenant = context.tenantRental;
    if (!tenant || tenant.businessId !== input.businessId || tenant.attractionId !== input.attractionId || !tenant.isActive) throw new TourismError("TENANT_RENTAL_NOT_AVAILABLE", "Tenant rental is not available.");
    return { revenueCategoryId: tenant.revenueCategoryId, revenueType: "TENANT_RENT", unitPrice: tenant.rentalPrice, amount: tenant.rentalPrice * BigInt(quantity), quantity, visitorCount };
  }

  validationCode(transactionNumber: string): string { return "TKT-" + transactionNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase(); }
  receiptNumber(transactionNumber: string): string { return "RCPT-" + transactionNumber; }
  qrPayload(transaction: Pick<VisitorTransaction, "businessId" | "id" | "validationCode" | "source" | "transactionDate">): Record<string, unknown> { return { businessId: transaction.businessId, transactionId: transaction.id, validationCode: transaction.validationCode, source: transaction.source, date: transaction.transactionDate.toISOString() }; }
  validateTicket(transaction: VisitorTransaction | null): TicketValidationResult { if (!transaction) return { valid: false, reason: "NOT_FOUND" }; if (transaction.status !== "PAID") return { valid: false, reason: "NOT_PAID", transaction }; return { valid: true, transaction }; }

  private assertAttraction(input: CreateVisitorTransactionInput, context: TourismPricingContext): void { const attraction = context.attraction; if (!attraction || attraction.businessId !== input.businessId || !attraction.isActive) throw new TourismError("ATTRACTION_NOT_AVAILABLE", "Attraction is not available."); this.assertSchedule(attraction, input.transactionDate); }
  private assertSchedule(entity: { startsOn?: Date | null; endsOn?: Date | null }, date: Date): void { if (entity.startsOn && date < entity.startsOn) throw new TourismError("SCHEDULE_NOT_ACTIVE", "Selected date is before active schedule."); if (entity.endsOn && date > entity.endsOn) throw new TourismError("SCHEDULE_NOT_ACTIVE", "Selected date is after active schedule."); }
  private assertVisitorLimit(limit: number | null, used: number, requested: number): void { if (limit !== null && used + requested > limit) throw new TourismError("VISITOR_LIMIT_EXCEEDED", "Visitor limit exceeded.", { limit, used, requested }); }
  private scheduledPrice(date: Date, daily: bigint, weekend?: bigint | null, seasonal?: bigint | null, starts?: Date | null, ends?: Date | null): bigint { if (seasonal !== null && seasonal !== undefined && starts && ends && date >= starts && date <= ends) return seasonal; return this.weekendAwarePrice(date, daily, weekend); }
  private weekendAwarePrice(date: Date, daily: bigint, weekend?: bigint | null): bigint { return weekend !== null && weekend !== undefined && [0, 6].includes(date.getUTCDay()) ? weekend : daily; }
}

