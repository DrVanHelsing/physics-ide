import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { assignments, classes, notifications, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { REMOVED_STUDENT } from "./shares.js";

type NotificationRow = typeof notifications.$inferSelect;

/** One renderer, one place (design D§3): the server builds the sentence so
 *  names resolve live (an erased person reads "Removed student" everywhere,
 *  §11's one place to act) and the client renders strings, never id-joins.
 *  Deleted referents render the generic sentence for the type — never a
 *  500, never a dropped row. */
const FALLBACK_TEXT: Record<string, string> = {
  "assignment.published": "A new assignment was published",
  "assignment.marks_released": "Marks were released",
  "assignment.mark_returned": "Work was returned for changes",
  "assignment.group_mark_returned": "Work was returned for changes",
  "assignment.due_reminder_sent": "An assignment is due tomorrow",
  "assignment.reminded": "A reminder from your teacher",
  "assignment.submitted": "A submission was received",
  "class.joined": "Someone joined your class",
  "class.join_requested": "Someone asked to join your class",
  "invite.accepted": "Someone joined your class",
  "project.shared": "A project was shared with you",
  "project.share_accepted": "Your shared project was added",
};

async function renderAll(db: FastifyInstance["db"], rows: NotificationRow[]) {
  const p = (r: NotificationRow) => r.payload as Record<string, string | number | undefined>;
  const assignmentIds = [...new Set(rows.map((r) => p(r).assignmentId).filter(Boolean))] as string[];
  const classIds = [...new Set(rows.map((r) => p(r).classId).filter(Boolean))] as string[];
  const personIds = [
    ...new Set(rows.flatMap((r) => [p(r).sharerId, p(r).recipientId, p(r).joinerId]).filter(Boolean)),
  ] as string[];
  const [aRows, cRows, uRows] = await Promise.all([
    assignmentIds.length
      ? db.select({ id: assignments.id, title: assignments.title }).from(assignments).where(inArray(assignments.id, assignmentIds))
      : [],
    classIds.length
      ? db.select({ id: classes.id, name: classes.name }).from(classes).where(inArray(classes.id, classIds))
      : [],
    personIds.length
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, personIds))
      : [],
  ]);
  const aTitle = new Map(aRows.map((r) => [r.id, r.title]));
  const cName = new Map(cRows.map((r) => [r.id, r.name]));
  const uName = new Map(uRows.map((r) => [r.id, r.name]));
  const person = (id: unknown) => (id ? uName.get(id as string) ?? REMOVED_STUDENT : REMOVED_STUDENT);

  return rows.map((r) => {
    const d = p(r);
    const title = d.assignmentId ? aTitle.get(d.assignmentId as string) : undefined;
    const cls = d.classId ? cName.get(d.classId as string) : undefined;
    let text: string | undefined;
    switch (r.type) {
      case "assignment.published":
        if (title && cls) text = `New assignment in ${cls}: “${title}”`;
        break;
      case "assignment.marks_released":
        if (title) text = `Marks released: “${title}”`;
        break;
      case "assignment.mark_returned":
      case "assignment.group_mark_returned":
        if (title) text = `Work returned for changes: “${title}”`;
        break;
      case "assignment.due_reminder_sent":
        if (title) text = `Due tomorrow: “${title}”`;
        break;
      case "assignment.reminded":
        if (title) text = `Reminder from your teacher: “${title}”`;
        break;
      case "assignment.submitted":
        if (title) {
          const attempt = typeof d.attempt === "number" && d.attempt > 1 ? ` (attempt ${d.attempt})` : "";
          text = `Submission received: “${title}”${attempt}`;
        }
        break;
      case "class.joined":
      case "invite.accepted":
        if (cls) text = `${person(d.joinerId)} joined ${cls}`;
        break;
      case "class.join_requested":
        if (cls) text = `${person(d.joinerId)} asked to join ${cls}`;
        break;
      case "project.shared":
        text = `${person(d.sharerId)} shared “${d.title ?? "a project"}” with you`;
        break;
      case "project.share_accepted":
        text = `${person(d.recipientId)} added “${d.title ?? "a project"}” to their projects`;
        break;
    }
    /* href: exactly three shapes, matching App.js's route table — assignments
       are NESTED UNDER THE CLASS (/classes/:id/assignments/:aid; there is
       no /assignments/:id route, and the catch-all would bounce to the
       IDE). Every assignment payload in the Task 5 site table carries both
       ids for exactly this reason. Final review M4: a join REQUEST's
       approval control lives on the People tab, not the (default)
       Assignments tab a bare /classes/:id lands on — so that one type
       routes to /classes/:id/people instead. */
    const href =
      d.assignmentId && d.classId
        ? `/classes/${d.classId}/assignments/${d.assignmentId}`
        : d.classId && r.type === "class.join_requested"
          ? `/classes/${d.classId}/people`
          : d.classId
            ? `/classes/${d.classId}`
            : "/classes";
    return {
      id: r.id,
      type: r.type,
      text: text ?? FALLBACK_TEXT[r.type] ?? "Something happened",
      href,
      createdAt: r.createdAt.getTime(),
      readAt: r.readAt ? r.readAt.getTime() : null,
    };
  });
}

export function notificationRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.get("/api/notifications", async (req) => {
    // Final review I2: `Number("-1") || 30` is -1 (truthy), which used to
    // reach the DB as `LIMIT -1` (500) — and a fractional limit ("1.5")
    // reached it as an invalid bigint literal (also a 500). Only a positive
    // INTEGER is accepted; anything else (negative, zero, fractional,
    // missing, non-numeric) falls back to the default page size — never a
    // 500 (the posture this same plan states verbatim at shares.ts:396 and
    // admin.ts:171/301).
    const limitRaw = Number((req.query as { limit?: string }).limit);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;
    const rows = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.id))
      .limit(limit);
    const [{ n: unreadCount }] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, req.user!.id), isNull(notifications.readAt)));
    return { notifications: await renderAll(app.db, rows), unreadCount };
  });

  app.post("/api/notifications/read", async (req) => {
    // Final review M5: unbounded before — a confirmed user could post
    // ~100k ids into one IN clause. `.max(200)` rejects an over-long array
    // the same way `parsed.success` already handles any other malformed
    // body below: it falls back to `ids = undefined`, i.e. this route's
    // existing no-`ids` behaviour (mark every one of the caller's own
    // unread rows read). This route has never returned 400 for a bad body,
    // and the write stays scoped to `req.user!.id` either way, so the
    // fallback is safe, not just convenient.
    const parsed = z
      .object({ ids: z.array(z.number().int()).max(200).optional() })
      .safeParse(req.body ?? {});
    const ids = parsed.success ? parsed.data.ids : undefined;
    await app.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        ids && ids.length
          ? and(eq(notifications.userId, req.user!.id), inArray(notifications.id, ids))
          : and(eq(notifications.userId, req.user!.id), isNull(notifications.readAt)),
      );
    return { ok: true };
  });
}
