import { describe, test, expect } from "vitest";
import { WorkspaceRulesSchema, BUILT_IN_RULE_SETS } from "./workspaceRules.js";

describe("built-in workspace rule sets", () => {
  test("all three built-in sets validate against the schema", () => {
    for (const set of Object.values(BUILT_IN_RULE_SETS)) {
      expect(() => WorkspaceRulesSchema.parse(set)).not.toThrow();
    }
  });

  test("open_practice switches everything on", () => {
    expect(BUILT_IN_RULE_SETS.open_practice).toEqual({
      editors: "both",
      debug: true,
      importFiles: true,
      exportAndCopy: true,
      advancedBlocks: true,
      templates: true,
    });
  });

  test("standard_classwork (the default) has import, export and templates off", () => {
    const s = BUILT_IN_RULE_SETS.standard_classwork;
    expect(s.importFiles).toBe(false);
    expect(s.exportAndCopy).toBe(false);
    expect(s.templates).toBe(false);
    expect(s.debug).toBe(true);
    expect(s.advancedBlocks).toBe(true);
    expect(s.editors).toBe("both");
  });

  test("locked_assessment switches every tool off", () => {
    expect(BUILT_IN_RULE_SETS.locked_assessment).toEqual({
      editors: "both",
      debug: false,
      importFiles: false,
      exportAndCopy: false,
      advancedBlocks: false,
      templates: false,
    });
  });

  test("schema rejects an unknown editors value", () => {
    expect(() =>
      WorkspaceRulesSchema.parse({ ...BUILT_IN_RULE_SETS.open_practice, editors: "voice" })
    ).toThrow();
  });
});
