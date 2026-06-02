import { describe, expect, it } from "vitest";

import { journalSchema, cashTransactionSchema, inventoryStockInSchema, purchaseOrderSchema } from "../../src/presentation/api/request-schemas";
import { parseAndValidate, ValidationError } from "../../src/presentation/api/validation";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });
}

async function expectFieldError(body: unknown, schema: Parameters<typeof parseAndValidate>[1], field: string) {
  await expect(parseAndValidate(jsonRequest(body), schema)).rejects.toMatchObject({ fields: expect.objectContaining({ [field]: expect.any(Array) }) });
}

describe("API input validation", () => {
  it("rejects invalid amount", async () => {
    await expectFieldError({
      type: "CASH_IN",
      transactionDate: "2026-05-31",
      cashAccountId: "550e8400-e29b-41d4-a716-446655440000",
      amount: "-1",
      description: "Deposit",
    }, cashTransactionSchema, "amount");
  });

  it("rejects invalid date", async () => {
    await expectFieldError({
      type: "CASH_IN",
      transactionDate: "not-a-date",
      cashAccountId: "550e8400-e29b-41d4-a716-446655440000",
      amount: "100",
      description: "Deposit",
    }, cashTransactionSchema, "transactionDate");
  });

  it("rejects missing required fields", async () => {
    await expectFieldError({ transactionDate: "2026-05-31", source: "MANUAL", lines: [] }, journalSchema, "description");
  });

  it("rejects invalid enum", async () => {
    await expectFieldError({
      type: "INVALID",
      transactionDate: "2026-05-31",
      cashAccountId: "550e8400-e29b-41d4-a716-446655440000",
      amount: "100",
      description: "Deposit",
    }, cashTransactionSchema, "type");
  });

  it("rejects negative quantity", async () => {
    await expectFieldError({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      locationId: "550e8400-e29b-41d4-a716-446655440001",
      movementDate: "2026-05-31",
      quantity: "-2",
      unitCost: "100",
      description: "Stock in",
    }, inventoryStockInSchema, "quantity");
  });

  it("rejects malformed UUID", async () => {
    await expectFieldError({
      supplierId: "bad-id",
      orderDate: "2026-05-31",
      grniAccountId: "550e8400-e29b-41d4-a716-446655440000",
      apAccountId: "550e8400-e29b-41d4-a716-446655440001",
      items: [{ productId: "550e8400-e29b-41d4-a716-446655440002", quantity: "1", unitCost: "100" }],
    }, purchaseOrderSchema, "supplierId");
  });

  it("exposes field-level validation errors", async () => {
    try {
      await parseAndValidate(jsonRequest({}), cashTransactionSchema);
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toHaveProperty("type");
      expect((error as ValidationError).fields).toHaveProperty("amount");
    }
  });
});
