import { computeAssignmentPhase } from "@physics-ide/shared";
import { assignments } from "../db/schema.js";

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause.
 *  One home for what was four byte-identical private copies (Plan 7 Stage 0:
 *  projects.ts, auth.ts, members.ts, assignments.ts). */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

/** §11's own word for an erased person — ONE string for the whole tree
 *  (design D§5, fiat 6). The erase scrub WRITES this into `users.name`
 *  and every read-time fallback resolves TO it, so a scrubbed row and an
 *  id that resolves to nothing can never disagree on a surface. It lives
 *  here rather than in `routes/shares.ts` because `routes/admin.ts` needs
 *  it too and neither route file should import the other; shares.ts
 *  re-exports it as `REMOVED_STUDENT` for the Plan 7 call sites that
 *  already name it that way. */
export const ERASED_NAME = "Removed student";

/** Dates cross the wire as epoch ms; timestamptz lives only inside Postgres. */
export function toEpoch(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

/** Students see an assignment only once it has left draft (spec §5.1).
 *  A draft 404s rather than 403s — its existence is the teacher's business.
 *  Lives HERE, not exported from assignments.ts, because groups.ts needs it
 *  too and assignments.ts already imports from groups.ts (assignments.ts:37)
 *  — exporting it the other way would close an ESM cycle. The guides
 *  predicate of the same name is a DIFFERENT test over a different row and
 *  is renamed guideVisibleToStudent, never merged (design D§14.10). */
export function visibleToStudent(a: typeof assignments.$inferSelect): boolean {
  return computeAssignmentPhase(a, new Date()) !== "draft";
}
