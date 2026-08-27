import type { FastifyInstance } from "fastify";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  assignments,
  classes,
  classMembers,
  events,
  groupMembers,
  groups,
  submissions,
  users,
} from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { config } from "../config.js";
import { dueTomorrow } from "../email/templates.js";
import type { Db } from "../db/types.js";

type AssignmentRow = typeof assignments.$inferSelect;

const TICK_SECRET_HEADER = "x-tick-secret";
const FORBIDDEN = "Forbidden.";
const DUE_REMINDER_SENT = "assignment.due_reminder_sent";
const HOUR_MS = 60 * 60 * 1000;

/** Design D§6 / task 24: the one scheduled surface — Cloud Scheduler calls
 *  this once a day in production; dev gets an hourly setInterval in
 *  server.ts hitting the same endpoint. The 2-hour-wide window (23h–25h
 *  out) gives a caller that isn't perfectly on-the-hour room to never miss
 *  an assignment sitting right at the edge; the events-ledger dedupe below
 *  is what actually stops a student being emailed twice no matter how many
 *  times the window re-covers the same assignment. */
async function assignmentsDueTomorrow(db: Db, now: Date): Promise<AssignmentRow[]> {
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
      ),
    );
}

/** Every active student of `a`'s class who does not yet have a current
 *  submission — the same "credit" rule assignments.ts's currentSubmissionFor
 *  and the upcoming-strip/inbox routes already apply: individual work checks
 *  the student's own row, pair/group work checks their GROUP's row, since
 *  one submission credits every member (spec §5.5) and a member of a group
 *  that has submitted has nothing left to be nagged about. */
async function studentsWithoutSubmission(
  db: Db,
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
      ),
    );
  if (roster.length === 0) return [];

  if (a.submissionMode === "individual") {
    const rosterIds = roster.map((r) => r.id);
    const submitted = await db
      .select({ submitterId: submissions.submitterId })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, a.id),
          eq(submissions.isCurrent, true),
          inArray(submissions.submitterId, rosterIds),
        ),
      );
    const submittedIds = new Set(submitted.map((s) => s.submitterId));
    return roster.filter((r) => !submittedIds.has(r.id));
  }

  // Pair/group work: submission is keyed by the GROUP, so "missing" is
  // resolved through group membership, not the roster id directly.
  const memberRows = await db
    .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groups.assignmentId, a.id));
  const groupByUser = new Map(memberRows.map((m) => [m.userId, m.groupId]));

  const groupIds = [...new Set(memberRows.map((m) => m.groupId))];
  const submittedGroups = groupIds.length
    ? await db
        .select({ groupId: submissions.groupId })
        .from(submissions)
        .where(
          and(
            eq(submissions.assignmentId, a.id),
            eq(submissions.isCurrent, true),
            inArray(submissions.groupId, groupIds),
          ),
        )
    : [];
  const submittedGroupIds = new Set(submittedGroups.map((s) => s.groupId));

  return roster.filter((r) => {
    const groupId = groupByUser.get(r.id);
    // Never joined a group at all: nothing to credit them with, still missing.
    if (!groupId) return true;
    return !submittedGroupIds.has(groupId);
  });
}

/** The events table IS the dedupe ledger (task 24 brief) — no new table.
 *  One read for the whole tick, not one per student: at this project's
 *  200-user cap the entire history of this one event type is small enough
 *  to fetch outright, matched in JS the same way this codebase's own tests
 *  read events back (filter by type, then match the payload), rather than
 *  reaching for a jsonb query operator nothing else here uses. */
async function alreadyReminded(db: Db): Promise<Set<string>> {
  const rows = await db.select({ payload: events.payload }).from(events).where(eq(events.type, DUE_REMINDER_SENT));
  return new Set(
    rows.map((r) => {
      const p = r.payload as { assignmentId?: string; userId?: string };
      return `${p.assignmentId ?? ""}:${p.userId ?? ""}`;
    }),
  );
}

export function tickRoutes(app: FastifyInstance): void {
  app.post("/api/tick", async (req, reply) => {
    // Guard first, and the exact same reply either way a wrong secret and a
    // missing one look identical to the caller (global constraint: no leak
    // about *why* the door didn't open).
    if (req.headers[TICK_SECRET_HEADER] !== config.tickSecret) {
      return reply.code(403).send({ error: FORBIDDEN });
    }

    const now = new Date();
    const dueSoon = await assignmentsDueTomorrow(app.db, now);
    const sentAlready = await alreadyReminded(app.db);

    let sent = 0;
    for (const a of dueSoon) {
      const missing = await studentsWithoutSubmission(app.db, a);
      if (missing.length === 0) continue;

      const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
      const className = classRows[0]?.name ?? "";

      for (const student of missing) {
        const key = `${a.id}:${student.id}`;
        if (sentAlready.has(key)) continue;
        sentAlready.add(key); // guards a duplicate within this same tick too

        // logEvent inside its own small transaction — the same weight this
        // file's siblings give their one-write records — and the event IS
        // the dedupe row, so there is nothing else for the transaction to
        // cover. Email fans out AFTER it commits (submit/remind's ordering).
        await app.db.transaction(async (tx) => {
          await logEvent(tx, DUE_REMINDER_SENT, null, { assignmentId: a.id, userId: student.id });
        });

        const mail = dueTomorrow({
          name: student.name,
          title: a.title,
          className,
          dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        });
        await app.mailer.send({ to: student.email, toUserId: student.id, template: "due-tomorrow", ...mail });
        sent += 1;
      }
    }

    return { sent };
  });
}
