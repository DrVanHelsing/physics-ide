/**
 * Assignment metadata — deliberately OUTSIDE manifests, mirroring
 * utils/storage/syncMeta.js exactly (same localforage instance, its own
 * store). Cached against a project id once assignment work has started
 * (startWork.js's cacheContext), so the IDE can render assignment chrome —
 * title, due date, workspace rules — for that project without another
 * round trip once it opens (Task 11 wires the consumers + its own test file;
 * this task creates the module complete, per the controller ruling).
 *
 * One record per project: { assignmentId, classId, title, dueAt, rules,
 * groupId }.
 *
 * `groupId` (Task 22) names the group whose SHARED project this local copy
 * is, or null for ordinary individual work. It is written as an explicit
 * null rather than left absent because "this project is not group work" is a
 * fact the IDE reads offline, and it decides which routes the project's
 * saves take: a group project's saves go through the group endpoints, never
 * the personal sync engine (plan Stage D's architectural note).
 */
import localforage from "localforage";

const metaStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "assignment-meta",
});

const PREFIX = "assignment-meta:";

export async function getAssignmentMeta(projectId) {
  const v = await metaStore.getItem(PREFIX + projectId);
  return v || null;
}

export async function setAssignmentMeta(projectId, meta) {
  await metaStore.setItem(PREFIX + projectId, {
    assignmentId: meta.assignmentId,
    classId: meta.classId,
    title: meta.title,
    dueAt: meta.dueAt,
    rules: meta.rules,
    groupId: meta.groupId ?? null,
  });
}

export async function deleteAssignmentMeta(projectId) {
  await metaStore.removeItem(PREFIX + projectId);
}

export async function listAssignmentMeta() {
  const out = {};
  await metaStore.iterate((value, key) => {
    if (key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = value;
  });
  return out;
}

export async function _resetAssignmentMetaForTests() {
  await metaStore.clear();
}
