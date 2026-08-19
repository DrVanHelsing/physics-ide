import { describe, test, expect, beforeEach } from "vitest";
import { clearCloudProjectsAfterSignOut } from "../signOutCleanup";
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
});

describe("final-review fix: sign-out hygiene on a shared device (F3)", () => {
  test("cloud-owned projects and their meta leave the device; guest work stays", async () => {
    const cloud = await saveProject(createManifest({ title: "student A's cloud project" }));
    const guest = await saveProject(createManifest({ title: "work made on this computer" }));
    await setSyncMeta(cloud.id, { ownerId: "u-A", remoteUpdatedAt: 1, lastPushedAt: 1 });

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
