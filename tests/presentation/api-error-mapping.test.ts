import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../src/features/shared/domain/domain-error";
import { PosError } from "../../src/features/pos/domain/pos-types";
import { SalesError } from "../../src/features/sales/domain/sales-types";
import { handleApi } from "../../src/presentation/api/route-handler";
import { problem } from "../../src/presentation/api/envelope";

describe("API error mapping", () => {
  it("treats every feature error as a domain error", () => {
    expect(new PosError("X", "x")).toBeInstanceOf(DomainError);
    expect(new SalesError("X", "x")).toBeInstanceOf(DomainError);
  });

  it("returns a domain error with its own code, message and 400", async () => {
    const response = await handleApi(async () => {
      throw new SalesError("ONLY_DRAFT_CAN_BE_CONFIRMED", "Only draft sales can be confirmed.");
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "ONLY_DRAFT_CAN_BE_CONFIRMED",
      message: "Only draft sales can be confirmed."
    });
  });

  it("passes through domain error details", async () => {
    const response = await handleApi(async () => {
      throw new PosError("CART_EMPTY", "Cannot checkout an empty cart.", { transactionId: "tx-1" });
    });

    await expect(response.json()).resolves.toMatchObject({ details: { transactionId: "tx-1" } });
  });

  it("reports an unexpected failure as 500, not 400", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleApi(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    });

    expect(response.status).toBe(500);
    spy.mockRestore();
  });

  it("never puts an internal error message on the wire", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "postgresql://admin:hunter2@db.internal:5432/prod";
    const response = await handleApi(async () => {
      throw new Error("Can't reach database server at " + secret);
    });

    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("db.internal");
    expect(body).toContain("INTERNAL_ERROR");
    spy.mockRestore();
  });

  it("logs the unexpected failure server-side so it is not lost", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    problem(new Error("boom"));

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain("unhandled error");
    spy.mockRestore();
  });

  it("does not log domain errors as failures", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    problem(new PosError("CART_EMPTY", "Cannot checkout an empty cart."));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
