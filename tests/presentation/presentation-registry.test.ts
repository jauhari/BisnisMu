import { describe, expect, it } from "vitest";
import { componentSpec, designSystemComponents } from "../../src/presentation/theme/design-system-manifest";
import { clearAppServicesForTests, getAppServices } from "../../src/presentation/api/service-composition";
import { uiModuleRegistry } from "../../src/presentation/modules/ui-registry";

describe("presentation registries", () => {
  it("declares required glass design-system components with native UI disabled", () => {
    expect(componentSpec("GlassTable")?.nativeUiAllowed).toBe(false);
    expect(componentSpec("GlassDatePicker")?.nativeUiAllowed).toBe(false);
    expect(designSystemComponents.length).toBeGreaterThanOrEqual(28);
  });

  it("maps major backend modules to UI registry entries", () => {
    expect(uiModuleRegistry.map((item) => item.id)).toEqual(expect.arrayContaining(["accounting", "ar-ap", "inventory", "purchase", "sales", "pos", "cash", "reporting", "dashboard"]));
  });

  it("requires service composition registration before API binding use", () => {
    clearAppServicesForTests();
    expect(() => getAppServices()).toThrow(/not been registered/i);
  });
});
