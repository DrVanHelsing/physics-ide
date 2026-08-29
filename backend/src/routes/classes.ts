import type { FastifyInstance } from "fastify";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import {
  CreateClassInputSchema,
  UpdateClassSettingsInputSchema,
} from "@physics-ide/shared";
import { classes, classMembers, shares } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { generateClassCode } from "../classes/codes.js";
import {
  getMembership,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";

type ClassRow = typeof classes.$inferSelect;

/** DEPLOY.md box 8 — class-creation cap, DB-counted per creator account
 *  (not per IP: this is a role-checked, authenticated route). Counted as
 *  `classes` rows with `createdBy = caller` and `createdAt > now() - 1
 *  hour`, closed against the same check-then-act race Task 5's per-address
 *  reset cap named a CRITICAL for (auth.ts:36-53): the count and the
 *  insert below share ONE transaction under a per-account advisory lock,
 *  so two concurrent creations from the same account can't both read the
 *  same under-cap count and both proceed. */
export const CLASS_CREATE_CAP = 10;
export const CLASS_CREATE_WINDOW_MS = 60 * 60 * 1000;
export const CLASS_CREATE_CAP_MESSAGE =
  "You've created a lot of classes recently. Try again in a bit.";

/** classid for the class-creation cap's per-account advisory lock
 *  (two-argument `pg_advisory_xact_lock(classid, key)` form — a namespace
 *  entirely separate from the one-argument form, so this can't collide
 *  with signup's bare `pg_advisory_xact_lock(42)` or tick.ts's
 *  `pg_advisory_xact_lock(100024)`). Distinct from auth.ts's own two-arg
 *  classid (100025, the reset cap) so the two per-subject locks can never
 *  contend with each other either. */
const CLASS_CREATE_LOCK_CLASSID = 100026;

class ClassCreateCapReached extends Error {}

/** D§8's lapse, reused: pending hand-offs lapse the same way whether the
 *  class switch goes off or the class itself is archived — one row and one
 *  event each, for("update") to serialize against a concurrent accept. */
async function lapsePendingShares(tx: Db, classId: string, actorId: string): Promise<void> {
  const pending = await tx
    .select()
    .from(shares)
    .where(and(eq(shares.classId, classId), eq(shares.status, "pending")))
    .for("update");
  for (const s of pending) {
    await tx
      .update(shares)
      .set({ status: "lapsed", resolvedAt: new Date() })
      .where(eq(shares.id, s.id));
    await logEvent(tx, "project.share_lapsed", actorId, {
      shareId: s.id,
      classId,
      sharerId: s.sharerId,
      recipientId: s.recipientId,
    });
  }
}

function toClassSummary(row: ClassRow, myRole: string | null, includeCode: boolean) {
  return {
    id: row.id,
    name: row.name,
    subjectLabel: row.subjectLabel,
    joinMode: row.joinMode,
    archived: row.archived,
    peerSharing: row.peerSharing,
    myRole,
    ...(includeCode ? { joinCode: row.joinCode } : {}),
  };
}

export function classRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes", async (req, reply) => {
    if (!(req.user!.isTeacher || req.user!.role === "admin")) {
      return reply.code(403).send({ error: "Only teacher accounts can create classes." });
    }
    const parsed = CreateClassInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const joinCode = await generateClassCode(app.db);
    let created: ClassRow;
    try {
      created = await app.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${CLASS_CREATE_LOCK_CLASSID}, hashtext(${req.user!.id}))`,
        );
        const [{ count: recentClasses }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(classes)
          .where(
            and(
              eq(classes.createdBy, req.user!.id),
              gt(classes.createdAt, new Date(Date.now() - CLASS_CREATE_WINDOW_MS)),
            ),
          );
        if (recentClasses >= CLASS_CREATE_CAP) throw new ClassCreateCapReached();
        const [c] = await tx
          .insert(classes)
          .values({
            name: parsed.data.name,
            subjectLabel: parsed.data.subjectLabel ?? null,
            joinCode,
            createdBy: req.user!.id,
          })
          .returning();
        await tx.insert(classMembers).values({ classId: c.id, userId: req.user!.id, role: "teacher" });
        await logEvent(tx, "class.created", req.user!.id, { classId: c.id, name: c.name });
        return c;
      });
    } catch (err) {
      if (err instanceof ClassCreateCapReached) {
        return reply.code(429).send({ error: CLASS_CREATE_CAP_MESSAGE });
      }
      throw err;
    }
    return reply.code(201).send({ class: toClassSummary(created, "teacher", true) });
  });

  app.get("/api/classes", async (req) => {
    const memberships = await app.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.userId, req.user!.id));
    if (memberships.length === 0) return { classes: [] };
    const rows = await app.db
      .select()
      .from(classes)
      .where(inArray(classes.id, memberships.map((m) => m.classId)));
    const byId = new Map(memberships.map((m) => [m.classId, m]));
    return {
      classes: rows.map((c) => {
        const m = byId.get(c.id)!;
        return {
          ...toClassSummary(c, m.role, m.role === "teacher" && m.status === "active"),
          myStatus: m.status,
        };
      }),
    };
  });

  app.get("/api/classes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const m = await getMembership(app.db, id, req.user!.id);
    if (!m) return reply.code(404).send({ error: "No such class." });
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    const [{ count }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(classMembers)
      .where(and(eq(classMembers.classId, id), eq(classMembers.status, "active")));
    return {
      class: {
        ...toClassSummary(c, m.role, m.role === "teacher" && m.status === "active"),
        myStatus: m.status,
        activeMembers: count,
      },
    };
  });

  app.patch("/api/classes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const parsed = UpdateClassSettingsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const patch: Partial<typeof classes.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.subjectLabel !== undefined) patch.subjectLabel = parsed.data.subjectLabel;
    if (parsed.data.joinMode !== undefined) patch.joinMode = parsed.data.joinMode;
    if (parsed.data.peerSharing !== undefined) patch.peerSharing = parsed.data.peerSharing;
    if (Object.keys(patch).length === 0) return { class: toClassSummary(c, "teacher", true) };
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx.update(classes).set(patch).where(eq(classes.id, id)).returning();
      // D§8: the switch is a live control — new shares stop, PENDING
      // hand-offs lapse. Accepted copies are the recipient's own projects
      // and stand; the ledger keeps every row it ever wrote.
      if (patch.peerSharing === false && c.peerSharing === true) {
        await lapsePendingShares(tx, id, req.user!.id);
      }
      await logEvent(tx, "class.updated", req.user!.id, { classId: id, patch });
      return row;
    });
    return { class: toClassSummary(updated, "teacher", true) };
  });

  app.post("/api/classes/:id/regenerate-code", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const joinCode = await generateClassCode(app.db);
    await app.db.transaction(async (tx) => {
      await tx.update(classes).set({ joinCode }).where(eq(classes.id, id));
      await logEvent(tx, "class.code_regenerated", req.user!.id, { classId: id });
    });
    return { joinCode };
  });

  for (const action of ["archive", "unarchive"] as const) {
    app.post(`/api/classes/:id/${action}`, async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        await requireClassTeacher(app.db, id, req.user!.id);
      } catch (err) {
        if (await sendClassAuthError(reply, err)) return;
        throw err;
      }
      const archived = action === "archive";
      await app.db.transaction(async (tx) => {
        // §11's retention clock (Task 8) starts here and nowhere else: the
        // sweep (Task 9) ages classes off `archivedAt`, so unarchiving must
        // clear it — an unarchived-then-rearchived class gets a fresh date,
        // not the stale one from its first archiving.
        await tx
          .update(classes)
          .set({ archived, archivedAt: archived ? new Date() : null })
          .where(eq(classes.id, id));
        // Archiving closes the seam the same way the switch-off does:
        // nothing pending survives into an archived class to be accepted.
        if (archived) {
          await lapsePendingShares(tx, id, req.user!.id);
        }
        await logEvent(tx, archived ? "class.archived" : "class.unarchived", req.user!.id, {
          classId: id,
        });
      });
      return { ok: true, archived };
    });
  }
}
