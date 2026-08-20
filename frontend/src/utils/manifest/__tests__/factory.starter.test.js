import { describe, test, expect } from "vitest";
import { createManifest } from "../factory";

describe("blank projects open on something, not nothing", () => {
  test("a blank physics project is pre-seeded with the simulation frame", () => {
    const m = createManifest({ goal: "physics" });
    expect(m.workspace.xml).toContain('type="sim_start_block"');
    expect(m.workspace.xml).toContain('type="sim_end_block"');
  });

  test("an explicit workspaceXml always wins (templates and imports are untouched)", () => {
    const m = createManifest({ goal: "physics", workspaceXml: "<xml><block type='sphere_block'/></xml>" });
    expect(m.workspace.xml).toBe("<xml><block type='sphere_block'/></xml>");
  });

  test("data-science and hybrid keep their own starter", () => {
    for (const goal of ["datascience", "hybrid"]) {
      expect(createManifest({ goal }).workspace.xml).toContain('type="ds_start_block"');
    }
  });

  test("a code-first blank project is NOT seeded — its editor is Python", () => {
    const m = createManifest({ goal: "physics", projectType: "code_blank", preferredEditor: "code" });
    expect(m.workspace.xml).toBe("");
  });
});
