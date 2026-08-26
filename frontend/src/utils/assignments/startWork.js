/**
 * Start (or continue) assignment work — design D§2: the server is the
 * authority for "have I started this assignment", and the manifest is
 * never tagged with assignment metadata (that lives in assignmentMeta.js,
 * outside the manifest, same as sync-meta).
 *
 * The sequence below IS the design — never reorder it:
 *   1. Build a fresh local manifest from the assignment's seed (or none).
 *   2. saveProject — the id has to exist locally before anything downstream
 *      can reference it.
 *   3. Stamp LAST_PROJECT_KEY so a reload of "/" finds this project.
 *   4. Push it to the server (sync engine) — assignment_work's projectId
 *      foreign key needs the projects row to already be there.
 *   5. POST /start to create (or fetch, if already started) the
 *      assignment_work link.
 *   6. Cache assignment context against the projectId, so the IDE can
 *      render assignment chrome once it opens that project (Task 11).
 *
 * Requires the network — the assignment page is server data anyway, so
 * there is no offline path to preserve here. Deliberately does NOT go
 * through useProject().createNew: that hook needs the IDE's Simulation/
 * Project contexts, which the portal never mounts. createManifest +
 * saveProject are the context-free storage primitives underneath it.
 */
import { api } from "../api/client";
import { createManifest } from "../manifest/factory";
import { saveProject } from "../storage/projectStore";
import { setAssignmentMeta } from "../storage/assignmentMeta";
import { getGlobalSyncEngine } from "../sync/syncEngine";
import { LAST_PROJECT_KEY } from "../../constants";

/**
 * @param {{ assignment: object, me: { id: string } }} args
 * @returns {Promise<string>} the local projectId to open at "/"
 */
export async function startAssignmentWork({ assignment, me }) {
  if (assignment.myWork) {
    await cacheContext(assignment, assignment.myWork.projectId);
    return assignment.myWork.projectId;
  }
  const seed = assignment.starterSeed;
  const manifest = createManifest({
    goal: assignment.projectType,
    title: assignment.title,
    projectType: seed?.workspaceXml || seed?.python ? "block_template" : "custom",
    workspaceXml: seed?.workspaceXml ?? "",
    python: seed?.python ?? "",
    preferredEditor: seed?.preferredEditor ?? "blocks",
  });
  const saved = await saveProject(manifest);
  try {
    localStorage.setItem(LAST_PROJECT_KEY, saved.id);
  } catch {
    /* storage blocked */
  }
  const engine = await getGlobalSyncEngine();
  await engine.pushProject(saved.id, me.id); // the FK needs the row server-side
  await api(`/api/assignments/${assignment.id}/start`, { method: "POST", body: { projectId: saved.id } });
  await cacheContext(assignment, saved.id);
  return saved.id;
}

async function cacheContext(assignment, projectId) {
  await setAssignmentMeta(projectId, {
    assignmentId: assignment.id,
    classId: assignment.classId,
    title: assignment.title,
    dueAt: assignment.dueAt,
    rules: assignment.rules ?? null,
  });
}
