import { describe, expect, it } from "vitest";

import { parseChangelog } from "@/presentation/changelog/changelog";

describe("parseChangelog", () => {
  it("mem-parse versi + section + bullets", () => {
    const md = [
      "# Changelog",
      "",
      "## [0.5.0] - 2026-06-03",
      "",
      "### Added — Feature A",
      "- A1",
      "- A2",
      "",
      "### Fixed — Bug B",
      "- B1",
      "",
      "## [0.4.0] - 2026-06-01",
      "",
      "### Added",
      "- C1",
      ""
    ].join("\n");

    const parsed = parseChangelog(md);
    expect(parsed.versions.length).toBe(2);
    const v0 = parsed.versions[0]!;
    expect(v0.version).toBe("0.5.0");
    expect(v0.date).toBe("2026-06-03");
    const s0 = v0.sections[0]!;
    const s1 = v0.sections[1]!;
    expect(s0.title).toContain("Added");
    expect(s0.bullets).toEqual(["A1", "A2"]);
    expect(s1.bullets).toEqual(["B1"]);
  });

  it("mengabaikan teks di luar versi", () => {
    const md = ["# Changelog", "", "Intro", "", "## [0.1.0] - 2026-01-01", "", "### Added", "- X"].join("\n");
    const parsed = parseChangelog(md);
    expect(parsed.versions.length).toBe(1);
    const v0 = parsed.versions[0]!;
    const s0 = v0.sections[0]!;
    expect(s0.bullets).toEqual(["X"]);
  });
});
