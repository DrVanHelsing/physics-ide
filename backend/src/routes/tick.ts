import type { FastifyInstance } from "fastify";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { assignments, classes, classMembers, events, users } from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { notify } from "../notifications/notify.js";
import { config } from "../config.js";
import { dueTomorrow } from "../email/templates.js";
import { rosterSubmissionStatus } from "./assignments.js";
import type { Db } from "../db/types.js";

type AssignmentRow = typeof assignments.$inferSelect;

const TICK_SECRET_HEADER = "x-tick-secret";
const FORBIDDEN = "Forbidden.";
const DUE_REMINDER_SENT = "assignment.due_reminder_sent";
const HOUR_MS = 60 * 60 * 1000;

/** A key private to this route's advisory lock (see below) — distinct from
 *  auth.ts's signup-cap lock (42): the two must never collide, or an
 *  unrelated signup would block behind a tick and vice versa. */
const TICK_LOCK_KEY = 100024;

/** Design D§6 / task 24: the one scheduled surface — Cloud Scheduler calls
 *  this once a day in production; dev gets an hourly setInterval in
 *  server.ts hitting the same endpoint. The 2-hour-wide window (23h–25h
 *  out) gives a caller that isn't perfectly on-the-hour room to never miss
 *  an assignment sitting right at the edge. Excludes a manually-closed
 *  assignment (`closedAt` set): `computeAssignmentPhase` already calls
 *  that row "closed" and the submit route already refuses it, so a student
 *  who can no longer act on it must not get an actionable-sounding email
 *  about it (fix round 1, review finding). */
async function assignmentsDueTomorrow(db: Pick<Db, "select">, now: Date): Promise<AssignmentRow[]> {
  const windowStart = new Date(now.getTime() + 23 * HOUR_MS);
  const windowEnd = new Date(now.getTime() + 25 * HOUR_MS);
  return db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.status, "published"),
        gte(assignments.dueAt, windowStart),
        lte(assignments.dueAt, windowEnd),
        sql`${assignments.closedAt} IS NULL`,
      ),
    );
}

/** Every active student of `a`'s class who does not yet have a current
 *  submission — resolved through rosterSubmissionStatus (assignments.ts),
 *  the one shared "has this student submitted" derivation GET /inbox also
 *  reads through (fix round 1, review finding: this used to be a third,
 *  independently-drifting copy of that rule).
 *
 *  Final review I3: an erased account can never sign in again, so it can
 *  never act on a reminder — `isNull(users.erasedAt)` keeps this whole
 *  pipeline (event, bell row, email to the erased+<id>@erased.invalid
 *  sentinel) from ever firing for one. This is the delivery-facing roster
 *  (nobody renders it), unlike inboxEntriesFor's `members`/`name`, which
 *  stays unfiltered so the teacher-facing inbox and gradebook keep showing
 *  "Removed student" with their marks (D§5). */
async function studentsWithoutSubmission(
  db: Pick<Db, "select">,
  a: AssignmentRow,
): Promise<Array<{ id: string; name: string; email: string }>> {
  const roster = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(classMembers)
    .innerJoin(users, eq(classMembers.userId, users.id))
    .where(
      and(
        eq(classMembers.classId, a.classId),
        eq(classMembers.status, "active"),
        eq(classMembers.role, "student"),
        isNull(users.erasedAt),
      ),
    );
  if (roster.length === 0) return [];
  const status = await rosterSubmissionStatus(db, a, roster.map((r) => r.id));
  return roster.filter((r) => !status.hasSubmission.has(r.id));
}

/** The events table IS the dedupe ledger (task 24 brief) — no new table.
 *  One read per tick, not one per student: at this project's 200-user cap
 *  the whole history of this one event type is small enough to fetch
 *  outright, matched in JS the same way this codebase's own tests read
 *  events back (filter by type, then match the payload), rather than
 *  reaching for a jsonb query operator nothing else here uses. Must be
 *  read from `tx` (see the route below) — reading it outside the locked
 *  transaction would reopen the exact race the lock exists to close. */
async function alreadyReminded(db: Pick<Db, "select">): Promise<Set<string>> {
  const rows = await db.select({ payload: events.payload }).from(events).where(eq(events.type, DUE_REMINDER_SENT));
  return new Set(
    rows.map((r) => {
      const p = r.payload as { assignmentId?: string; userId?: string };
      return `${p.assignmentId ?? ""}:${p.userId ?? ""}`;
    }),
  );
}

type PendingReminder = {
  student: { id: string; name: string; email: string };
  assignment: AssignmentRow;
  className: string;
};

export function tickRoutes(app: FastifyInstance): void {
  app.post("/api/tick", async (req, reply) => {
    // Guard first, and the exact same reply either way — a wrong secret and
    // a missing one look identical to the caller (global constraint: no
    // leak about *why* the door didn't open).
    if (req.headers[TICK_SECRET_HEADER] !== config.tickSecret) {
      return reply.code(403).send({ error: FORBIDDEN });
    }

    const now = new Date();

    // Cloud Scheduler's at-least-once/retry semantics (and, in dev, a slow
    // interval call overlapping the next hour's) make two overlapping ticks
    // a real possibility, not a hypothetical — design D§6 calls this "one
    // scheduler", so serializing overlapping calls IS the semantic. A
    // blocking advisory lock held for the WHOLE read-decide-log critical
    // section (not just the final write) is what makes that provably
    // single-send: a second tick's transaction blocks on this lock until
    // the first COMMITS, then re-reads alreadyReminded and finds the
    // first's rows already there, so it sends nothing for the same
    // (assignment, student) pair. This is the actual guarantee — a plain
    // in-memory check-then-act, or a lock scoped to only the insert, is not
    // enough (review finding, fix round 1).
    const toSend: PendingReminder[] = [];
    await app.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${TICK_LOCK_KEY})`);

      const dueSoon = await assignmentsDueTomorrow(tx, now);
      const sentAlready = await alreadyReminded(tx);

      for (const a of dueSoon) {
        const missing = await studentsWithoutSubmission(tx, a);
        if (missing.length === 0) continue;

        let className: string | null = null;
        for (const student of missing) {
          const key = `${a.id}:${student.id}`;
          if (sentAlready.has(key)) continue;
          sentAlready.add(key); // guards a duplicate within this same tick too

          if (className === null) {
            const classRows = await tx.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
            className = classRows[0]?.name ?? "";
          }

          // logEvent inside the SAME transaction as the lock and the read
          // that decided to send — the event IS the dedupe row, so there is
          // nothing else for this transaction to cover.
          const eid = await logEvent(tx, DUE_REMINDER_SENT, null, { assignmentId: a.id, userId: student.id });
          // Task 5, site 7: classId comes from the ASSIGNMENT row `a` — the
          // roster helper above returns only id/name/email.
          await notify(tx, [student.id], eid, DUE_REMINDER_SENT, {
            assignmentId: a.id,
            classId: a.classId,
          });
          toSend.push({ student, assignment: a, className });
        }
      }
    });

    // Email fans out AFTER the transaction (and the lock it held) commits —
    // submit/remind's own ordering. A crash here leaves the dedupe row
    // written but the email unsent; the brief's contract is "sent at most
    // once", not "sent exactly once", and that trade lands on the safe side.
    for (const item of toSend) {
      const mail = dueTomorrow({
        name: item.student.name,
        title: item.assignment.title,
        className: item.className,
        dueAt: item.assignment.dueAt ? item.assignment.dueAt.toISOString() : null,
      });
      await app.mailer.send({ to: item.student.email, toUserId: item.student.id, template: "due-tomorrow", ...mail });
    }

    return { sent: toSend.length };
  });
}
