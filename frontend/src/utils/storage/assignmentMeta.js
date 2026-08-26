/**
 * Assignment metadata — deliberately OUTSIDE manifests, mirroring
 * utils/storage/syncMeta.js exactly (same localforage instance, its own
 * store). Cached against a project id once assignment work has started
 * (startWork.js's cacheContext), so the IDE can render assignment chrome —
 * title, due date, workspace rules — for that project without another
 * round trip once it opens (Task 11 wires the consumers + its own test file;
 * this task creates the module complete, per the controller ruling).
 *
 * One record per project: { assignmentId, classId, title, dueAt, rules }.
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
