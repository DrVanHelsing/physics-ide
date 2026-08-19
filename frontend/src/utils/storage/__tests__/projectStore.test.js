/**
 * Tests for the project store. Runs in jsdom; localForage falls back to its
 * in-memory driver if IndexedDB isn't available, which is fine for these
 * tests because we only assert on observable behavior, not the backend.
 */

import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
  exportProjectJson,
  importProjectFromText,
  _resetAllProjectStorageForTests,
} from "../projectStore";
import { createManifest } from "../../manifest/factory";
import { SCHEMA_VERSION } from "../../manifest/schema";

beforeEach(async () => {
  await _resetAllProjectStorageForTests();
});

describe("projectStore CRUD", () => {
  test("list is empty initially", async () => {
    const list = await listProjects();
    expect(list).toEqual([]);
  });

  test("save round-trips a manifest and bumps updatedAt", async () => {
    const m = createManifest({ goal: "physics", title: "Round trip" });
    const originalUpdated = m.updatedAt;
    // Wait a tick so Date.now advances at least 1 ms on every platform.
    await new Promise((r) => setTimeout(r, 2));
    const saved = await saveProject(m);
    expect(saved.id).toBe(m.id);
    expect(saved.updatedAt).toBeGreaterThanOrEqual(originalUpdated);
    const loaded = await loadProject(m.id);
    expect(loaded.id).toBe(m.id);
    expect(loaded.title).toBe("Round trip");
  });

  test("save updates the project-list summary", async () => {
    const a = createManifest({ goal: "physics", title: "A" });
    const b = createManifest({ goal: "datascience", title: "B" });
    await saveProject(a);
    await saveProject(b);
    const list = await listProjects();
    expect(list).toHaveLength(2);
    const ids = list.map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    const summary = list.find((p) => p.id === b.id);
    expect(summary.goal).toBe("datascience");
    expect(summary.title).toBe("B");
  });

  test("list is sorted by updatedAt descending", async () => {
    const a = createManifest({ goal: "physics", title: "A" });
    await saveProject(a);
    await new Promise((r) => setTimeout(r, 5));
    const b = createManifest({ goal: "hybrid", title: "B" });
    await saveProject(b);
    const list = await listProjects();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  test("loadProject returns null for unknown id", async () => {
    expect(await loadProject("does-not-exist")).toBeNull();
  });

  test("deleteProject removes manifest and summary", async () => {
    const m = createManifest({ goal: "physics", title: "Bye" });
    await saveProject(m);
    expect(await loadProject(m.id)).not.toBeNull();
    await deleteProject(m.id);
    expect(await loadProject(m.id)).toBeNull();
    const list = await listProjects();
    expect(list.find((p) => p.id === m.id)).toBeUndefined();
  });

  test("saveProject rejects an invalid manifest", async () => {
    const m = createManifest({ goal: "physics", title: "Bad" });
    await expect(saveProject({ ...m, goal: "chemistry" })).rejects.toThrow(/goal/);
  });

  test("saving the same manifest twice does not duplicate it in the list", async () => {
    const m = createManifest({ goal: "physics", title: "Once" });
    await saveProject(m);
    await saveProject(m);
    const list = await listProjects();
    expect(list.filter((p) => p.id === m.id)).toHaveLength(1);
  });
});

describe("projectStore export / import", () => {
  test("exportProjectJson serializes a valid manifest", () => {
    const m = createManifest({ goal: "datascience", title: "Export me" });
    const json = exportProjectJson(m);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe(m.id);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });

  test("importProjectFromText round-trips an exported manifest", async () => {
    const m = createManifest({ goal: "hybrid", title: "Round" });
    const json = exportProjectJson(m);
    const imported = await importProjectFromText(json);
    expect(imported.id).toBe(m.id);
    expect(imported.goal).toBe("hybrid");
  });

  test("importProjectFromText migrates a legacy v1 JSON dump", async () => {
    const legacy = JSON.stringify({
      mode: "blocks",
      pythonCode: "# legacy",
      workspaceXml: "<xml/>",
    });
    const imported = await importProjectFromText(legacy);
    expect(imported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(imported.goal).toBe("physics");
    expect(imported.workspace.xml).toBe("<xml/>");
    expect(imported.source.python).toBe("# legacy");
  });

  test("importProjectFromText rejects garbage", async () => {
    await expect(importProjectFromText("{not json")).rejects.toThrow(/not valid JSON/);
    await expect(importProjectFromText("[]")).rejects.toThrow();
  });
});

describe("saveProject timestamp preservation (sync)", () => {
  test("default stamps now; preserveTimestamp keeps the manifest's own updatedAt", async () => {
    const m = createManifest({ goal: "physics" });
    m.updatedAt = 12345;
    const stamped = await saveProject(m);
    expect(stamped.updatedAt).toBeGreaterThan(12345);

    const pulled = { ...stamped, updatedAt: 99999, title: "From cloud" };
    const preserved = await saveProject(pulled, { preserveTimestamp: true });
    expect(preserved.updatedAt).toBe(99999);
    const reloaded = await loadProject(m.id);
    expect(reloaded.updatedAt).toBe(99999);
    expect(reloaded.title).toBe("From cloud");
  });
});
