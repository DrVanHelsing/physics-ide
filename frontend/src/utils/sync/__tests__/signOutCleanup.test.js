import { describe, test, expect, beforeEach } from "vitest";
import { clearCloudProjectsAfterSignOut, shouldDropLocalCopy } from "../signOutCleanup";
import { getGlobalSyncEngine } from "../syncEngine";
import {
  saveProject,
  listProjects,
  loadProject,
  onProjectDeleted,
  _resetAllProjectStorageForTests,
} from "../../storage/projectStore";
import { setSyncMeta, listSyncMeta, _resetSyncMetaForTests } from "../../storage/syncMeta";
import { createManifest } from "../../manifest/factory";

beforeEach(async () => {
  await _resetAllProjectStorageForTests();
  await _resetSyncMetaForTests();
  const engine = await getGlobalSyncEngine();
  engine.setOnline(true);
  engine.reset();
});

describe("final-review fix: sign-out hygiene on a shared device (F3)", () => {
  test("a cleanly-synced project and its meta leave the device; guest work stays", async () => {
    const cloud = await saveProject(createManifest({ title: "student A's cloud project" }));
    const guest = await saveProject(createManifest({ title: "work made on this computer" }));
    // The server holds this exact version.
    await setSyncMeta(cloud.id, { ownerId: "u-A", remoteUpdatedAt: cloud.updatedAt, lastPushedAt: 1 });

    const deletes = [];
    const un = onProjectDeleted((id, opts) => deletes.push({ id, opts }));
    await clearCloudProjectsAfterSignOut();
    un();

    expect((await listProjects()).map((p) => p.id)).toEqual([guest.id]);
    expect(await loadProject(cloud.id)).toBeNull();
    expect(await listSyncMeta()).toEqual({});
    // Tagged fromSync so the delete never echoes to the server as a real
    // "the student deleted this project" — the account keeps its copy.
    expect(deletes).toEqual([{ id: cloud.id, opts: { fromSync: true } }]);
  });

  test("meta with no ownerId (guest-era / pre-stamping) is left strictly alone", async () => {
    const p = await saveProject(createManifest({ title: "legacy" }));
    await setSyncMeta(p.id, { ownerId: null, remoteUpdatedAt: 0, lastPushedAt: 0 });

    await clearCloudProjectsAfterSignOut();

    expect((await listProjects()).map((x) => x.id)).toEqual([p.id]);
    expect(Object.keys(await listSyncMeta())).toEqual([p.id]);
  });
});

/* Residual round, BREAKAGE 1: adoptLocalProject stamps meta BEFORE the push,
   so owned meta does NOT prove the server has the work. Deleting on ownership
   alone destroys the only copy of anything the server permanently refused
   (413 oversize / 403 cap / 400 invalid) or that is still parked. */
describe("residual fix: sign-out never deletes work the server doesn't hold", () => {
  test("an adopted-but-never-pushed project (remoteUpdatedAt 0) survives sign-out", async () => {
    const p = await saveProject(createManifest({ title: "too large to sync" }));
    await setSyncMeta(p.id, { ownerId: "u-A", remoteUpdatedAt: 0, lastPushedAt: 0 });

    await clearCloudProjectsAfterSignOut();

    expect((await listProjects()).map((x) => x.id)).toEqual([p.id]);
    expect(await loadProject(p.id)).not.toBeNull();
    // Its meta stays too, so the same user's next sign-in resumes it.
    expect(Object.keys(await listSyncMeta())).toEqual([p.id]);
  });

  test("a project parked in the engine's pending queue survives sign-out", async () => {
    const p = await saveProject(createManifest({ title: "parked for retry" }));
    // Timestamps alone would say "synced" — only the pending check saves it.
    await setSyncMeta(p.id, { ownerId: "u-A", remoteUpdatedAt: p.updatedAt, lastPushedAt: 1 });

    const engine = await getGlobalSyncEngine();
    engine.setOnline(false);
    await engine.pushProject(p.id, "u-A"); // parks the id, no network touched
    expect(engine.getPendingIds()).toContain(p.id);
    engine.setOnline(true);

    await clearCloudProjectsAfterSignOut();

    expect((await listProjects()).map((x) => x.id)).toEqual([p.id]);
    expect(Object.keys(await listSyncMeta())).toEqual([p.id]);
  });

  test("a local edit newer than the server's copy survives sign-out", () => {
    expect(
      shouldDropLocalCopy({
        meta: { ownerId: "u-A", remoteUpdatedAt: 1000 },
        manifest: { id: "p-1", updatedAt: 2000 },
        pendingIds: new Set(),
      }),
    ).toBe(false);
  });
});

/* Residual round, BREAKAGE 2: an interruption must never leave owned meta with
   no local copy — the next same-user reconcile reads that as "deleted on this
   device" and tombstones the LIVE cloud project. Meta goes first. */
describe("residual fix: meta is removed before the local copy", () => {
  test("by the time the project delete fires, its sync meta is already gone", async () => {
    const p = await saveProject(createManifest({ title: "ordered" }));
    await setSyncMeta(p.id, { ownerId: "u-A", remoteUpdatedAt: p.updatedAt, lastPushedAt: 1 });

    let metaSnapshotAtDeleteTime = null;
    const un = onProjectDeleted(() => {
      metaSnapshotAtDeleteTime = listSyncMeta();
    });
    await clearCloudProjectsAfterSignOut();
    un();

    expect(metaSnapshotAtDeleteTime).not.toBeNull();
    expect(await metaSnapshotAtDeleteTime).toEqual({});
  });
});
