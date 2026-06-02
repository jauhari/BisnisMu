import { describe, expect, it } from "vitest";
import { endpointRegistry, endpointsFor } from "../../src/presentation/api/endpoint-registry";
import { createFormDraft, markSaved, undoFormDraft, updateFormDraft } from "../../src/presentation/state/form-state";
import { defaultGlassTableState, reduceGlassTableState } from "../../src/presentation/state/table-reducer";
import { searchCommands } from "../../src/presentation/navigation/command-registry";

const sample = { name: "A", amount: 1 };

describe("presentation state utilities", () => {
  it("tracks dirty, save, and undo form states", () => {
    const draft = createFormDraft(sample);
    const updated = updateFormDraft(draft, { name: "B", amount: 2 });
    expect(updated.dirty).toBe(true);
    expect(undoFormDraft(updated).current).toEqual(sample);
    expect(markSaved(updated).dirty).toBe(false);
  });

  it("reduces table query, selection, and sort state", () => {
    const searched = reduceGlassTableState(defaultGlassTableState(), { type: "search", value: "invoice" });
    const sorted = reduceGlassTableState(searched, { type: "sort", sort: [{ id: "date", desc: true }] });
    const selected = reduceGlassTableState(sorted, { type: "select", ids: ["row-1"] });
    expect(selected.query.search).toBe("invoice");
    expect(selected.layout.sort).toEqual([{ id: "date", desc: true }]);
    expect(selected.selectedIds).toEqual(["row-1"]);
  });

  it("maps endpoint contracts to existing backend service operations", () => {
    expect(endpointRegistry.length).toBeGreaterThan(10);
    expect(endpointsFor("reports").map((endpoint) => endpoint.operation)).toContain("generateTrialBalance");
  });

  it("searches command registry across modules", () => {
    expect(searchCommands("invoice").some((command) => command.label.toLowerCase().includes("invoice"))).toBe(true);
  });

  it("keeps table layout state serializable for persistence", () => {
    const selected = reduceGlassTableState(defaultGlassTableState(), { type: "layout", layout: { columnOrder: ["account", "debit"], hiddenColumns: ["credit"], columnWidths: { account: 240 }, sort: [] } });
    expect(selected.layout.columnOrder).toEqual(["account", "debit"]);
    expect(selected.layout.hiddenColumns).toEqual(["credit"]);
    expect(selected.layout.columnWidths.account).toBe(240);
  });

});
