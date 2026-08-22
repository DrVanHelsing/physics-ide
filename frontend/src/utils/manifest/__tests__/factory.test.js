import { createManifest } from "../factory";
import { SCHEMA_VERSION, isManifest } from "../schema";

describe("createManifest", () => {
  test("produces a valid manifest with sensible defaults", () => {
    const m = createManifest();
    expect(isManifest(m)).toBe(true);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.goal).toBe("physics");
    expect(m.preferredEditor).toBe("blocks");
    expect(m.projectType).toBe("custom");
    expect(m.datasets).toEqual([]);
    expect(m.runs).toEqual([]);
    expect(m.chartSpecs).toEqual([]);
    expect(m.notes).toEqual([]);
    expect(m.checkpointState).toEqual({});
  });

  test("uses provided title when non-empty", () => {
    const m = createManifest({ title: "My experiment" });
    expect(m.title).toBe("My experiment");
  });

  test("falls back to a goal-specific default title when title is missing", () => {
    expect(createManifest({ goal: "physics" }).title).toMatch(/simulation/i);
    expect(createManifest({ goal: "datascience" }).title).toMatch(/data/i);
    expect(createManifest({ goal: "hybrid" }).title).toMatch(/hybrid/i);
  });

  test("createdAt and updatedAt are equal at creation", () => {
    const m = createManifest({ goal: "physics" });
    expect(m.createdAt).toBe(m.updatedAt);
  });

  test("each manifest gets a unique id", () => {
    const a = createManifest();
    const b = createManifest();
    expect(a.id).not.toBe(b.id);
  });

  test("respects supplied id when given", () => {
    const m = createManifest({ id: "p-fixed" });
    expect(m.id).toBe("p-fixed");
  });

  test("throws on invalid enums", () => {
    expect(() => createManifest({ goal: "chemistry" })).toThrow(/goal/);
    expect(() => createManifest({ preferredEditor: "voice" })).toThrow(/preferredEditor/);
    expect(() => createManifest({ projectType: "weird" })).toThrow(/projectType/);
  });

  test("carries workspaceXml and python through to the right slots", () => {
    const m = createManifest({ workspaceXml: "<xml/>", python: "print(1)" });
    expect(m.workspace.xml).toBe("<xml/>");
    expect(m.source.python).toBe("print(1)");
  });
});
