/**
 * Group project I/O — spec §5.5, plan Stage D.
 *
 * The plan's binding architectural note: group work does NOT ride the
 * personal sync engine. A group's shared project row lives under the
 * FOUNDING member's account (`projects` is keyed by a real user; there is no
 * group account), and every other member reaches it EXCLUSIVELY through the
 * group endpoints — `GET /api/projects/:id` 404s for them, because they
 * genuinely do not own it. So this module sits BESIDE syncEngine.js rather
 * than inside it: nothing here changes the engine, the manifest shape, or
 * the schema version, and the engine keeps ignoring projects it does not own.
 *
 * A member's local copy of the group project is a plain local manifest. Its
 * two crossings of the network are:
 *
 *   pullGroupProject  — the group's server head, into the local library.
 *     Ordinary opens (Continue) go through here too: this is how another
 *     member's save arrives.
 *   pushGroupProject  — one member's save, into the group's row. The server
 *     requires the baton and refuses without it; the refusal sentences are
 *     the server's own and reach the caller verbatim.
 *
 * `startGroupSaves` is the wiring between the local store and the second of
 * those — the same `projectStore.saveProject` listener contract SyncProvider
 * uses. It is registered ONLY while the assignment context carries a groupId
 * AND the baton is held (IDELayout does that, off what BatonChip reports),
 * so "may I write to the shared project" is answered by whether the listener
 * exists at all, not by a flag read inside it.
 */
import { api } from "../api/client";
import { listProjects, onProjectSaved, saveProject } from "../storage/projectStore";

/**
 * Fetch the group's shared head and write it into the local library.
 *
 * Saved with `preserveTimestamp` — a pull is not an edit. That flag is also
 * what stops the write from echoing straight back out again, both through
 * the group listener below and through SyncProvider's own.
 *
 * A local copy that is NEWER than the head is left exactly where it is,
 * mirroring the sync engine's own reconcile rule (`remote.clientUpdatedAt >
 * local.updatedAt` is what pulls). Opening the work must never be the thing
 * that discards a member's own unsent edit.
 *
 * @returns {Promise<object|null>} the manifest now in the local library for
 *   this group, or null if the group has no project yet.
 */
export async function pullGroupProject(groupId) {
  const head = await api(`/api/groups/${groupId}/project`);
  const manifest = head?.manifest;
  if (!manifest) return null;
  const local = (await listProjects()).find((p) => p.id === manifest.id);
  if (local && local.updatedAt >= head.clientUpdatedAt) return null;
  return saveProject(manifest, { preserveTimestamp: true });
}

/** Save one member's copy into the group's row. Requires the baton; the
 *  server's 409 sentence ("Another member holds the baton." /
 *  "Take the baton before saving.") comes back as the thrown message. */
export function pushGroupProject(groupId, manifest) {
  return api(`/api/groups/${groupId}/project`, { method: "PUT", body: { manifest } });
}

/**
 * Push every local save of THIS project into the group's row for as long as
 * the returned unsubscribe has not been called.
 *
 * `projectId` is required, not inferred: the listener fires for every project
 * in the library, and a member's own personal work must never be written into
 * the group's row.
 *
 * A refused or unreachable push is logged and swallowed — a local save is
 * never failed by the network (the same local-first guarantee the personal
 * engine gives), and the baton chip's next poll is what tells the member
 * their turn is over.
 */
export function startGroupSaves(groupId, projectId) {
  return onProjectSaved((manifest, opts) => {
    if (opts?.preserveTimestamp) return; // a pulled head is not an edit
    if (manifest.id !== projectId) return; // another project in the same library
    pushGroupProject(groupId, manifest).catch((err) => {
      console.warn(`group sync: could not save to the group — ${err.message}`);
    });
  });
}
