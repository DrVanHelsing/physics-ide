/**
 * AssignmentContext — Plan 6 (assignments), Task 11.
 *
 * Exposes the active project's assignment context — `{ assignmentId,
 * classId, title, dueAt, rules, groupId } | null` — to the IDE shell, keyed
 * on the active project id. Backed by utils/storage/assignmentMeta.js, the
 * same outside-the-manifest store startWork.js's D§2 sequence writes to
 * (cacheContext).
 *
 * `groupId` (Task 22) is what makes this project group work: BatonChip polls
 * that group's lease off it, and IDELayout locks the workspace to read-only
 * while the baton is elsewhere. It follows the same cache-then-refresh rule
 * as the rules do — a student who LEAVES their group has the group dropped
 * from their context on the next refresh (`myGroup: null`), and an offline
 * open keeps the cached group so group work opens read-only-aware without
 * the network.
 *
 * Behaviour (design D§2 + the task-10 review's pending-record fix round):
 *   - No project open, or signed out: null. Assignment work is signed-in by
 *     construction, so the `me` gate makes the guest IDE byte-identical —
 *     a cached record for a project id is never served to a guest, even if
 *     one happens to exist locally (e.g. a shared computer).
 *   - A cached record: served immediately (D§2 — "offline lessons run from
 *     the cache"), so the workspace-rules chip and later enforcement never
 *     wait on the network to know what's allowed.
 *   - Then a background refresh (`GET /api/assignments/:id`, keyed on the
 *     cached `assignmentId` — present on every record regardless of
 *     whether the project's server-side work row exists yet, see below)
 *     overwrites both the rendered context and the cache on success ("new
 *     rules next time they open the work"). A failed refresh (offline,
 *     revoked membership, teacher deleted the assignment) leaves the cache
 *     standing — the last known rules keep applying rather than the
 *     workspace silently opening up.
 *
 * Pending-start records: startWork.js's resolveLocalProject (task-10's fix
 * round) caches this exact shape against a freshly-created local project
 * BEFORE `/start` has confirmed the server-side assignment_work link — a
 * retry marker, not a fully-linked record. That's still genuine assignment
 * context (the title/rules/dueAt are real, cached from the assignment
 * payload the student was shown), so it's served the same as any other
 * cached record — rules enforcement erring toward enforcement is correct
 * here. The refresh GET this effect runs keys on `assignmentId`, which a
 * pending record carries just as any linked one does; the backend route
 * doesn't require a `myWork` row to answer, so refreshing a pending
 * project's context behaves identically to a linked one — see
 * AssignmentContext.test.js's pending-record case.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { useMe } from "../auth/useAuth";
import { api } from "../utils/api/client";
import { getAssignmentMeta, setAssignmentMeta } from "../utils/storage/assignmentMeta";

const Ctx = createContext(null);

/** Consume the assignment context. Null outside assignment work (or when
 *  called outside an AssignmentProvider, where createContext's own default
 *  of null applies). */
export const useAssignmentContext = () => useContext(Ctx);

export function AssignmentProvider({ projectId, children }) {
  const { data: me } = useMe();
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    let dead = false;
    if (!projectId || !me) { setCtx(null); return undefined; }
    (async () => {
      const cached = await getAssignmentMeta(projectId);
      if (dead) return;
      setCtx(cached);                       // offline lessons run from the cache (D§2)
      if (!cached) return;
      try {                                  // "new rules next time they open the work"
        const fresh = await api(`/api/assignments/${cached.assignmentId}`);
        if (dead) return;
        const meta = {
          assignmentId: cached.assignmentId,
          classId: fresh.assignment.classId,
          title: fresh.assignment.title,
          dueAt: fresh.assignment.dueAt,
          rules: fresh.assignment.rules ?? null,
          groupId: fresh.assignment.myGroup?.id ?? null,
          individualWork: fresh.assignment.individualWork ?? false,
        };
        await setAssignmentMeta(projectId, meta);
        setCtx(meta);
      } catch {
        // Offline or revoked — the cache stands.
      }
    })();
    return () => { dead = true; };
  }, [projectId, me]);

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
