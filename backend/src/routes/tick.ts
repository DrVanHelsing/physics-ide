import type { FastifyInstance } from "fastify";
import { and, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import {
  assignments,
  assignmentWork,
  classes,
  classMembers,
  emails,
  events,
  groupMembers,
  groups,
  guides,
  invites,
  marks,
  notifications,
  shares,
  submissions,
  users,
} from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { eligibleForRetention, readRetentionYears, YEAR_MS } from "../db/retention.js";
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
const DAY_MS = 24 * HOUR_MS;

/** A key private to this route's advisory lock (see below) — distinct from
 *  auth.ts's signup-cap lock (42): the two must never collide, or an
 *  unrelated signup would block behind a tick and vice versa. */
const TICK_LOCK_KEY = 100024;

/* ═══ Retention (Task 9, design D§7) ═══════════════════════════════════════ */

/** The sweep's OWN key, deliberately not TICK_LOCK_KEY. D§7 puts the sweep
 *  in a separate transaction from the reminder pass precisely so a sweep
 *  failure cannot roll the reminder dedupe rows back with it — sharing one
 *  key would re-couple the two through the lock that split exists to break,
 *  because a blocking `pg_advisory_xact_lock` serialises every holder of the
 *  same key. Free by inspection against the tree's other ONE-argument keys
 *  (auth.ts's 42 and TICK_LOCK_KEY above); the two-argument form used at
 *  100025/100026/100027 is a separate key namespace in Postgres and cannot
 *  collide with this. */
const RETENTION_LOCK_KEY = 100028;

/** One event per swept class, never one per tick — `events` rows are NEVER
 *  deleted (D§7), so this ledger row is what outlives the class. */
const CLASS_RETENTION_DELETED = "class.retention_deleted";

/** D§7 / fiat 7: the emails log is an operational surface (§10's
 *  "once-a-week glance"), not a §11 record — §11's "What we store" list
 *  never names it — so it self-prunes. The `emails_created_at_idx` index
 *  from Task 3 is what makes this cheap. */
const EMAIL_LOG_MAX_AGE_MS = 180 * DAY_MS;

/** D§7: one class per transaction, five per tick, so a backlog drains over
 *  days instead of in one long statement. */
const RETENTION_MAX_CLASSES_PER_TICK = 5;

/** The surface the sweep's transaction actually uses — the same structural
 *  `Pick<Db, …>` shape this file's other helpers take a `tx` through. */
type SweepTx = Pick<Db, "select" | "insert" | "delete" | "execute">;

/** Everything the sweep is about to destroy, counted BEFORE it is destroyed
 *  — the `class.retention_deleted` payload is the only record left once the
 *  rows are gone, so a count taken afterwards would be a row of zeros. The
 *  rows reached through `assignments` are counted through exactly the join
 *  the FK cascade will follow, so the record and the deletion agree. */
async function countClassScoped(tx: SweepTx, classId: string): Promise<Record<string, number>> {
  const one = async (rows: Promise<Array<{ count: number }>>): Promise<number> =>
    (await rows)[0]?.count ?? 0;
  const n = { count: sql<number>`count(*)::int` };
  return {
    members: await one(tx.select(n).from(classMembers).where(eq(classMembers.classId, classId))),
    invites: await one(tx.select(n).from(invites).where(eq(invites.classId, classId))),
    assignments: await one(tx.select(n).from(assignments).where(eq(assignments.classId, classId))),
    assignmentWork: await one(
      tx
        .select(n)
        .from(assignmentWork)
        .innerJoin(assignments, eq(assignmentWork.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId)),
    ),
    submissions: await one(
      tx
        .select(n)
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId)),
    ),
    marks: await one(
      tx
        .select(n)
        .from(marks)
        .innerJoin(assignments, eq(marks.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId)),
    ),
    groups: await one(
      tx
        .select(n)
        .from(groups)
        .innerJoin(assignments, eq(groups.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId)),
    ),
    groupMembers: await one(
      tx
        .select(n)
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(assignments, eq(groups.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId)),
    ),
    guides: await one(tx.select(n).from(guides).where(eq(guides.classId, classId))),
    shares: await one(tx.select(n).from(shares).where(eq(shares.classId, classId))),
    notifications: await one(
      tx.select(n).from(notifications).where(sql`${notifications.payload}->>'classId' = ${classId}`),
    ),
  };
}

/** D§7's sweep. Its own transaction PER CLASS, its own lock key, and it runs
 *  BEFORE the reminder pass — both halves of that matter, and the ordering is
 *  not cosmetic: `assignmentsDueTomorrow` below filters on status/dueAt/
 *  closedAt only and never excludes an archived class, so a class swept
 *  after the reminder transaction had already queued its mail would have a
 *  real postman deliver a reminder for a class that no longer exists.
 *
 *  The eligibility predicate is SHARED, not copied: `eligibleForRetention`,
 *  the `retention_years` read and the `YEAR_MS` clock live in
 *  db/retention.ts, imported by both this sweep and the admin preview at
 *  `GET /api/admin/retention`. The preview is a promise about what this
 *  function will delete, and one symbol is what makes disagreement
 *  structurally impossible — copy-discipline is the exact class of drift
 *  task 24's review already caught once (see rosterSubmissionStatus).
 *  `lte` on a NULL `archivedAt` is NULL, so a never-archived class is
 *  spared by the column as well as by the flag.
 *
 *  Select-and-delete happen inside the SAME locked transaction, so two
 *  overlapping ticks can never both claim the same class and write two
 *  ledger rows for one deletion. Oldest first, so a backlog drains in the
 *  order it aged. */
async function sweepRetiredClasses(db: Db, cutoff: Date): Promise<number> {
  let swept = 0;
  // Bounded attempts, not `while (true)`: a "raced" outcome below retries
  // with a fresh select, and the bound keeps even a pathological
  // archive/unarchive flip-flop from holding the tick open.
  for (
    let attempts = 0;
    swept < RETENTION_MAX_CLASSES_PER_TICK && attempts < RETENTION_MAX_CLASSES_PER_TICK * 2;
    attempts += 1
  ) {
    const outcome = await db.transaction(async (tx): Promise<"deleted" | "raced" | "none"> => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${RETENTION_LOCK_KEY})`);
      const [c] = await tx
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(eligibleForRetention(cutoff))
        .orderBy(classes.archivedAt)
        .limit(1);
      if (!c) return "none";

      const counts = await countClassScoped(tx, c.id);

      // 1. The class itself, and the FK cascade carries the rest:
      //    class_members, invites, assignments, guides, shares, and
      //    transitively submissions, marks, groups, group_members and
      //    assignment_work. Enumerating manual deletes for tables that
      //    already cascade would duplicate the schema and drift from it.
      //    NOTHING here touches `projects` (D§10 fiat 11): the group's
      //    founding member is LIVE and still holds the project locally with
      //    owned sync meta, so syncEngine.js would push it straight back on
      //    the next reconcile — a deletion that undoes itself is worse than
      //    no deletion, and individual assignment work was always kept.
      //    The predicate is RE-ASSERTED on the delete, not just the id:
      //    under READ COMMITTED a teacher's unarchive can commit between
      //    the select above and this statement, and the product's one
      //    irreversible statement does not get to win that race on a stale
      //    read (review round 1).
      const gone = await tx
        .delete(classes)
        .where(and(eq(classes.id, c.id), eligibleForRetention(cutoff)))
        .returning({ id: classes.id });
      if (gone.length === 0) return "raced";

      // 2. The class's bell rows. `notifications` has NO FK to `classes` —
      //    it is keyed on `users.id` and `events.id` only — and its link to
      //    the class is the denormalised `classId` every class-scoped
      //    notify() call site writes into the payload. Without this, every
      //    swept class leaves live bell rows pointing at 404s. Same
      //    "delivery state, not history" category the erase route deletes
      //    explicitly (admin.ts).
      await tx.delete(notifications).where(sql`${notifications.payload}->>'classId' = ${c.id}`);

      // 3. The ledger row that outlives it, in this same transaction.
      await logEvent(tx, CLASS_RETENTION_DELETED, null, { classId: c.id, name: c.name, counts });
      return "deleted";
    });
    if (outcome === "none") break;
    if (outcome === "deleted") swept += 1;
    // "raced": the class stopped being eligible mid-flight — nothing was
    // written for it, no ledger row exists, and the next select cannot
    // pick it again.
  }
  return swept;
}

/** The email log's own half of the sweep (D§7 / fiat 7) — its own
 *  transaction under the sweep's lock, for the same isolation reason. */
async function pruneEmailLog(db: Db, cutoff: Date): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${RETENTION_LOCK_KEY})`);
    const gone = await tx.delete(emails).where(lt(emails.createdAt, cutoff)).returning({ id: emails.id });
    return gone.length;
  });
}

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

    // ── Retention FIRST (design D§7) ──────────────────────────────────────
    // Before the reminder transaction, in transactions of its own, under a
    // lock key of its own. See sweepRetiredClasses for why both halves of
    // that matter. The period read, the clock and the eligibility predicate
    // are the SAME symbols the admin preview uses (db/retention.ts), so the
    // count an admin confirmed is the set this sweep deletes.
    //
    // Isolated, not load-bearing (review round 1): D§7's named harm is
    // "due-tomorrow reminders stop indefinitely" behind a broken sweep, and
    // the per-class transactions already make half-deleted state
    // unreachable — aborting the tick would protect nothing. So a sweep
    // failure is logged at error level, surfaced in the body, and the
    // reminder pass runs regardless: the chore cannot hold the promise
    // hostage. One catch around BOTH halves, never per class — a per-class
    // catch would skip a poison head-of-queue class silently forever.
    let retentionClasses = 0;
    let emailsPruned = 0;
    let retentionFailed = false;
    try {
      const retentionYears = await readRetentionYears(app.db);
      const cutoff = new Date(Date.now() - retentionYears * YEAR_MS);
      retentionClasses = await sweepRetiredClasses(app.db, cutoff);
      emailsPruned = await pruneEmailLog(app.db, new Date(now.getTime() - EMAIL_LOG_MAX_AGE_MS));
    } catch (err) {
      req.log.error(err, "retention sweep failed");
      retentionFailed = true;
    }

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

    // Honest names (D§7): `sent` was a lie the moment the tick did more than
    // one thing — and it never counted sends anyway, only reminders decided
    // on (a preference-gated recipient still counts here, and no email
    // leaves for them). Three numbers, each naming the pass that produced it
    // — plus `retentionFailed: true` ONLY when the sweep threw, because the
    // response an operator curls is the one place a failure is actually
    // seen, where a Scheduler error log is not.
    return retentionFailed
      ? { reminders: toSend.length, retentionClasses, emailsPruned, retentionFailed: true }
      : { reminders: toSend.length, retentionClasses, emailsPruned };
  });
}
