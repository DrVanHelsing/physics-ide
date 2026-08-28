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
 *
 * `flushGroupSaves` (fix round 1) is the barrier submit waits on before the
 * server snapshots the group's head — see its own comment below.
 */
import { api } from "../api/client";
import { listProjects, loadProject, onProjectSaved, saveProject } from "../storage/projectStore";

/* ── The push-failure channel ───────────────────────────────────
 *
 * A refused push is the earliest and most reliable news that this member's
 * turn is over: the server has just said so in as many words ("Another
 * member holds the baton." / "Take the baton before saving."). Swallowing
 * it into console.warn left the chip claiming a baton the member no longer
 * has — and the workspace editable — until the next 20-second poll.
 *
 * So a failed push announces itself, and BatonChip re-reads the baton at
 * once (the same re-read it already does after a 409 on take). Same
 * subscribe-and-unsubscribe shape as projectStore's own listeners, for the
 * same reason: the failure happens down here, and the thing that has to
 * react to it is up there.
 */
const pushFailedListeners = new Set();

/** @param {(err: Error) => void} fn @returns {() => void} unsubscribe */
export function onGroupPushFailed(fn) {
  pushFailedListeners.add(fn);
  return () => pushFailedListeners.delete(fn);
}

function announcePushFailed(err) {
  for (const fn of pushFailedListeners) {
    try {
      fn(err);
    } catch {
      /* a listener never breaks the save path it hangs off */
    }
  }
}

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
 * A refused or unreachable push never fails the local save — that is the
 * same local-first guarantee the personal engine gives — but it is not
 * swallowed either: it is announced (see the push-failure channel above) so
 * the baton chip can correct itself within a second, instead of leaving the
 * member typing into a workspace they no longer own until the next poll.
 */
/** This member's current save session — the group they may write to, what is
 *  in flight, and how the last push went. Null when they hold no baton. Read
 *  by the push barrier further down, which is where it is explained. */
let liveSession = null;

export function startGroupSaves(groupId, projectId) {
  const session = { groupId, projectId, pending: null, failure: null, pushedAt: null };
  liveSession = session;
  const stop = onProjectSaved((manifest, opts) => {
    if (opts?.preserveTimestamp) return; // a pulled head is not an edit
    if (manifest.id !== projectId) return; // another project in the same library
    session.pending = track(session, manifest);
  });
  return () => {
    stop();
    // The listener existing IS the permission to write, so ending it ends
    // the session outright: this member has no turn left, nothing of theirs
    // may be pushed, and submit has nothing here to wait on.
    if (liveSession === session) liveSession = null;
  };
}

/* ── The push barrier submit depends on ─────────────────────────
 *
 * The listener above is fire-and-forget on purpose — a refused push must
 * never fail the local save it hangs off. That left group submit able to
 * outrun it: the PUT carrying the student's newest save could still be in
 * flight when POST /submit was issued, and the server would then snapshot
 * (and FINGERPRINT — the documented dispute authority) the previous head.
 *
 * So the current save session is kept here, holding the in-flight push and
 * the last failure, and `flushGroupSaves` is the awaited barrier submit
 * calls first. It is the group's counterpart to the personal path's
 * `await engine.pushProject(...)` + `assertPushSucceeded(...)`.
 *
 * KNOWN LIMITATION, deliberately not papered over: this can only speak for
 * THIS browser. A member submitting while another member holds the baton
 * with unpushed edits — or whose own push failed in their browser —
 * snapshots the last head that actually landed. That is inherent to group
 * work, not something a barrier here could detect.
 */

/** The one sentence a submit refused by this barrier shows. Its own precise
 *  wording is the point: the student's change is not lost, it simply has not
 *  reached the group yet, and saving again is what fixes it. */
export const GROUP_PUSH_FAILED_MESSAGE =
  "Your last change hasn't reached the group yet — save it again before submitting.";

/** Push one manifest and remember how it went. Never rejects: the local save
 *  path must stay local-first, so the failure is recorded on the session
 *  (where the barrier finds it) and announced, not thrown. */
function track(session, manifest) {
  session.pushedAt = manifest.updatedAt;
  return pushGroupProject(session.groupId, manifest).then(
    () => {
      session.failure = null;
    },
    (err) => {
      console.warn(`group sync: could not save to the group — ${err.message}`);
      session.failure = err;
      announcePushFailed(err);
    },
  );
}

/**
 * Settle this member's group saves before their work is snapshotted.
 *
 *   - a push already in flight is awaited, so submit never races it;
 *   - a local copy that has not gone up yet is pushed FIRST (the brief's
 *     literal "group push, then submit") — the listener only fires on a
 *     save, and a session may not have seen one;
 *   - a push that never landed throws, so the caller refuses the submit
 *     rather than handing in a head the student never saw;
 *   - and all three run in ONE loop rather than in sequence, because a save
 *     landing between the wait and the re-read would otherwise slip past
 *     both (see the loop's own comment).
 *
 * A member with no save session (not the baton holder) has nothing of their
 * own in flight and no permission to write: this resolves at once.
 *
 * @param {string} groupId @returns {Promise<void>}
 */
export async function flushGroupSaves(groupId) {
  const session = liveSession && liveSession.groupId === groupId ? liveSession : null;
  if (!session) return;

  // ONE loop, not drain-then-check. A save landing between those two steps
  // used to escape both: `track()` stamps `pushedAt` synchronously, so by the
  // time the freshness check read the store it saw a local copy that matched
  // and concluded there was nothing to send — while the push that save had
  // just started was never awaited, and a failure in it never reached the
  // check below. Each pass drains what is in flight and then re-reads; the
  // barrier lifts only on a pass that finds nothing left to do.
  for (;;) {
    const before = session.pending;
    await drain(session);
    const local = await loadProject(session.projectId);
    // Re-pushing a copy the listener already sent would file a duplicate
    // checkpoint on the group's history for no reason — the timeline names
    // who saved what (spec §5.5), so it must not be padded with saves nobody
    // made.
    if (local && local.updatedAt !== session.pushedAt) {
      session.pending = track(session, local);
      continue;
    }
    if (session.pending === before) break; // a full pass changed nothing
  }
  if (session.failure) throw new Error(GROUP_PUSH_FAILED_MESSAGE);
}

/** Wait until nothing is in flight. One await is not enough: an autosave
 *  landing WHILE we wait starts another push, and submit has to be behind
 *  the LAST of them — being behind only the first is the same race in
 *  smaller clothes. */
async function drain(session) {
  let awaited = null;
  while (session.pending && session.pending !== awaited) {
    awaited = session.pending;
    await awaited;
  }
}
