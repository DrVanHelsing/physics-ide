/**
 * Start (or continue) assignment work — design D§2: the server is the
 * authority for "have I started this assignment", and the manifest is
 * never tagged with assignment metadata (that lives in assignmentMeta.js,
 * outside the manifest, same as sync-meta).
 *
 * The core sequence is the design — never reorder it:
 *   1. Build a fresh local manifest from the assignment's seed (or none).
 *   2. saveProject — the id has to exist locally before anything downstream
 *      can reference it.
 *   3. Stamp LAST_PROJECT_KEY so a reload of "/" finds this project.
 *   4. Push it to the server (sync engine) — assignment_work's projectId
 *      foreign key needs the projects row to already be there.
 *   5. POST /start to create (or fetch, if already started) the
 *      assignment_work link.
 *   6. Cache assignment context against the LINKED projectId (the server's,
 *      not necessarily this attempt's own — see "second device" below), so
 *      the IDE can render assignment chrome once it opens that project
 *      (Task 11).
 *
 * Two things step 4-5 have to account for, discovered in task-10 review:
 *
 *   - `engine.pushProject` NEVER THROWS (syncEngine.js's own design — see
 *     `adoptLocalProject`'s comment there). A failed push otherwise proceeds
 *     straight into POST /start, which 404s with a real but misleading
 *     "No such project." — the project row simply never made it
 *     server-side. `assertPushSucceeded` checks `engine.getStatus()` right
 *     after, the same way `adoptLocalProject` does, and throws an honest
 *     error instead.
 *
 *   - Retrying after that failure must NOT mint a second local project and
 *     abandon the first — `resolveLocalProject` caches the newly-created
 *     project against this assignment via `cacheContext` immediately (not
 *     only on full success), so a later call can find and reuse that SAME
 *     pending project via `findPendingLocalProject` instead of creating a
 *     new one every retry.
 *
 *   - `/start`'s response is the authority on which project actually got
 *     linked, not just this attempt's own local copy — under a genuine
 *     concurrent double-start (two tabs), the loser's insert is skipped
 *     server-side and the WINNER's row is returned instead (design D§2's
 *     "second device" backstop). The loser must adopt that id, not keep
 *     working in its own now-orphaned copy — see the `linkedProjectId`
 *     handling below, which also drops the loser's now-stale pending cache.
 *
 * Task 22 adds one branch and changes nothing else: for pair/group work the
 * founding member's path above is untouched (their push IS what /start
 * links), while every member who arrives after the group has started gets
 * their local copy from `pullGroupProject` instead of minting and pushing
 * one of their own. The same applies to the race loser, who in a group is a
 * different PERSON rather than a second tab — the winning project sits on
 * someone else's account, so there is nothing local to adopt.
 *
 * Requires the network — the assignment page is server data anyway, so
 * there is no offline path to preserve here. Deliberately does NOT go
 * through useProject().createNew: that hook needs the IDE's Simulation/
 * Project contexts, which the portal never mounts. createManifest +
 * saveProject are the context-free storage primitives underneath it.
 */
import { api } from "../api/client";
import { pullGroupProject } from "./groupSync";
import { createManifest } from "../manifest/factory";
import { saveProject, loadProject } from "../storage/projectStore";
import { setAssignmentMeta, listAssignmentMeta, deleteAssignmentMeta } from "../storage/assignmentMeta";
import { getGlobalSyncEngine } from "../sync/syncEngine";
import { LAST_PROJECT_KEY } from "../../constants";

const PUSH_FAILED_MESSAGE = "Could not reach the server — check your connection and try again.";

/**
 * @param {{ assignment: object, me: { id: string } }} args
 * @returns {Promise<string>} the local projectId to open at "/"
 */
export async function startAssignmentWork({ assignment, me }) {
  // Pair/group work (Task 22): the FIRST member to start pushes their own
  // copy exactly as an individual does — it becomes the group's shared
  // project, on their account. Every LATER member has nothing of their own
  // to offer: the server hands back the existing row, and their local copy
  // comes down the group route (`/api/projects/:id` would 404 for them,
  // since they do not own it).
  const groupId = assignment.myGroup?.id ?? null;

  if (assignment.myWork) {
    await cacheContext(assignment, assignment.myWork.projectId);
    stampLastProject(assignment.myWork.projectId);
    if (groupId) await pullGroupProject(groupId);
    return assignment.myWork.projectId;
  }

  const saved = await resolveLocalProject(assignment);

  stampLastProject(saved.id);

  const engine = await getGlobalSyncEngine();
  await engine.pushProject(saved.id, me.id); // the FK needs the row server-side
  assertPushSucceeded(engine);

  const res = await api(`/api/assignments/${assignment.id}/start`, {
    method: "POST",
    body: { projectId: saved.id },
  });
  const linkedProjectId = res.work.projectId;
  if (linkedProjectId !== saved.id) {
    // Lost a concurrent double-start race — this attempt's local copy was
    // never the one the server linked. Drop its pending cache so it stops
    // masquerading as this assignment's working copy.
    await deleteAssignmentMeta(saved.id);
  }
  await cacheContext(assignment, linkedProjectId);
  if (linkedProjectId !== saved.id) {
    stampLastProject(linkedProjectId);
    // In a group the winner is usually a DIFFERENT MEMBER, so the linked
    // project is not on this account at all — there is nothing local to
    // adopt and the group route is the only way to it.
    if (groupId) await pullGroupProject(groupId);
  }
  return linkedProjectId;
}

/** So a reload of "/" — and the bootstrap restore ProjectContext runs there
 *  — finds the project this click just settled on, not whichever one was
 *  open last. */
function stampLastProject(projectId) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    /* storage blocked */
  }
}

/**
 * The local project to push+link for a fresh start: reuse one already
 * created (and pending-cached) by an earlier attempt for THIS assignment,
 * if a push failure left one behind, rather than minting a new one and
 * abandoning the last attempt's orphan on every retry. Otherwise build and
 * save a fresh manifest from the assignment's seed, caching it against the
 * assignment right away — not only once the whole sequence succeeds — so a
 * later retry can find it here.
 */
async function resolveLocalProject(assignment) {
  const pending = await findPendingLocalProject(assignment.id);
  if (pending) return pending;

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
  await cacheContext(assignment, saved.id);
  return saved;
}

/** A local project already cached (assignmentMeta) against `assignmentId` —
 *  by construction only ever left behind by an earlier attempt that failed
 *  before /start linked it (a fully-started assignment short-circuits via
 *  `assignment.myWork` above and never reaches this lookup). */
async function findPendingLocalProject(assignmentId) {
  const all = await listAssignmentMeta();
  const entry = Object.entries(all).find(([, meta]) => meta?.assignmentId === assignmentId);
  if (!entry) return null;
  const [projectId] = entry;
  const manifest = await loadProject(projectId);
  if (!manifest) {
    // The cached pointer outlived the project itself (e.g. deleted locally)
    // — stale bookkeeping, not a project to resume.
    await deleteAssignmentMeta(projectId);
    return null;
  }
  return manifest;
}

export function assertPushSucceeded(engine) {
  const status = engine.getStatus();
  if (status.state === "error" || status.state === "offline") {
    throw new Error(PUSH_FAILED_MESSAGE);
  }
}

async function cacheContext(assignment, projectId) {
  await setAssignmentMeta(projectId, {
    assignmentId: assignment.id,
    classId: assignment.classId,
    title: assignment.title,
    dueAt: assignment.dueAt,
    rules: assignment.rules ?? null,
    // Which routes this project's saves take, cached with everything else so
    // the IDE knows it offline (Task 22).
    groupId: assignment.myGroup?.id ?? null,
  });
}
