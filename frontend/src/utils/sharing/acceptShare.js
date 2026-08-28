/**
 * Accept a share — design D§4's order, which is startWork.js's documented
 * order, and it must not be reordered:
 *
 *   1. POST accept — the SERVER mints the copy row with its attribution in
 *      one transaction and returns the manifest, id already rewritten to
 *      the fresh mint this call supplies.
 *   2. saveProject with preserveTimestamp — a pull is not an edit
 *      (groupSync.js's rule); the local library now holds the copy.
 *   3. Sidecar attribution write — BEFORE the push, so the label can never
 *      render behind the project it belongs to.
 *   4. pushProject + assertPushSucceeded — pushProject never throws
 *      (startWork.js's discovery); and because the server already holds a
 *      byte-identical head, this push is the identical-re-push no-op
 *      projects.ts guarantees — it is the CONNECTIVITY check and the sync
 *      adoption, not the creation.
 *   5. requestProjectOpen — same reason startWork announces: a client-side
 *      navigate remounts nothing.
 *
 * A refusal (the cap sentence, a lapsed share) throws out of step 1 with
 * the server's own words; nothing local has happened yet.
 */
import { api } from "../api/client";
import { generateId } from "../manifest/factory";
import { saveProject } from "../storage/projectStore";
import { setShareAttribution } from "../storage/shareMeta";
import { getGlobalSyncEngine } from "../sync/syncEngine";
import { assertPushSucceeded } from "../assignments/startWork";
import { requestProjectOpen } from "../projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../constants";

export async function acceptShare(share, me) {
  const res = await api(`/api/shares/${share.id}/accept`, {
    method: "POST",
    body: { projectId: generateId() },
  });
  await saveProject(res.manifest, { preserveTimestamp: true }); // a pull is not an edit
  await setShareAttribution(res.manifest.id, res.attribution);
  try {
    localStorage.setItem(LAST_PROJECT_KEY, res.manifest.id);
  } catch {
    /* storage blocked */
  }
  const engine = await getGlobalSyncEngine();
  await engine.pushProject(res.manifest.id, me.id);
  assertPushSucceeded(engine);
  requestProjectOpen(res.manifest.id);
  return res.manifest.id;
}
