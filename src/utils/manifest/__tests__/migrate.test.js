import { migrate, readLegacyV1, LEGACY_V1_KEY } from "../migrate";
import { isManifest, SCHEMA_VERSION } from "../schema";
import { createManifest } from "../factory";

describe("migrate", () => {
  test("returns null for null / undefined input", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(undefined)).toBeNull();
  });

  test("passes through a valid v2 manifest", () => {
    const v2 = createManifest({ goal: "datascience", title: "Already v2" });
    expect(migrate(v2)).toBe(v2);
  });

  test("throws when a v2 manifest is structurally invalid", () => {
    const v2 = createManifest({ goal: "physics", title: "Bad v2" });
    expect(() => migrate({ ...v2, goal: "chemistry" })).toThrow(/structurally invalid/);
  });

  test("throws when schemaVersion is from the future", () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 5 })).toThrow(/cannot read/);
  });

  test("migrates a legacy v1 blocks-mode state into a Physics project", () => {
    const v1 = {
      mode: "blocks",
      pythonCode: "# from a block save",
      workspaceXml: "<xml><block/></xml>",
    };
    const m = migrate(v1);
    expect(isManifest(m)).toBe(true);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.goal).toBe("physics");
    expect(m.projectType).toBe("custom");
    expect(m.preferredEditor).toBe("blocks");
    expect(m.workspace.xml).toBe("<xml><block/></xml>");
    expect(m.source.python).toBe("# from a block save");
    expect(m.title).toMatch(/Recovered/i);
  });

  test("maps legacy mode='text' to preferredEditor='code'", () => {
    const v1 = { mode: "text", pythonCode: "x = 1", workspaceXml: "" };
    const m = migrate(v1);
    expect(m.preferredEditor).toBe("code");
  });

  test("accepts partial legacy state (only some v1 fields present)", () => {
    const m = migrate({ pythonCode: "only code" });
    expect(isManifest(m)).toBe(true);
    expect(m.source.python).toBe("only code");
    expect(m.workspace.xml).toBe("");
  });

  test("throws on unrecognized shapes", () => {
    expect(() => migrate({ totally: "different" })).toThrow(/unrecognized/);
  });
});

describe("readLegacyV1", () => {
  function memStorage(initial = {}) {
    const store = { ...initial };
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
  }

  test("returns null when the key is absent", () => {
    expect(readLegacyV1(memStorage())).toBeNull();
  });

  test("returns the parsed legacy object when present", () => {
    const s = memStorage({
      [LEGACY_V1_KEY]: JSON.stringify({ mode: "blocks", pythonCode: "p", workspaceXml: "x" }),
    });
    const v1 = readLegacyV1(s);
    expect(v1).toEqual({ mode: "blocks", pythonCode: "p", workspaceXml: "x" });
  });

  test("returns null on corrupt JSON", () => {
    const s = memStorage({ [LEGACY_V1_KEY]: "{not-json" });
    expect(readLegacyV1(s)).toBeNull();
  });
});
