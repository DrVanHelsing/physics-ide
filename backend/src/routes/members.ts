import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { JoinByCodeInputSchema } from "@physics-ide/shared";
import { classes, classMembers, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { getMembership, requireClassTeacher, sendClassAuthError } from "../classes/guards.js";
import { logEvent } from "../db/events.js";

export function memberRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/join", async (req, reply) => {
    const parsed = JoinByCodeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That code doesn't look right." });
    }
    const rows = await app.db.select().from(classes).where(eq(classes.joinCode, parsed.data.code));
    const c = rows[0];
    if (!c) return reply.code(404).send({ error: "No class has that code." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    if (c.joinMode === "paused") {
      return reply.code(403).send({ error: "Joining this class is paused." });
    }
    const existing = await getMembership(app.db, c.id, req.user!.id);
    if (existing) return reply.code(409).send({ error: "You're already in this class." });

    const status = c.joinMode === "approval" ? "waiting" : "active";
    try {
      await app.db.transaction(async (tx) => {
        await tx.insert(classMembers).values({
          classId: c.id,
          userId: req.user!.id,
          role: "student",
          status,
        });
        await logEvent(
          tx,
          status === "active" ? "class.joined" : "class.join_requested",
          req.user!.id,
          { classId: c.id },
        );
      });
    } catch (err) {
      // check-then-insert is TOCTOU under concurrent joins; the unique
      // (classId, userId) constraint is the real guard against a double join.
      if (pgErrorCode(err) === "23505") {
        return reply.code(409).send({ error: "You're already in this class." });
      }
      throw err;
    }
    return { ok: true, classId: c.id, className: c.name, status };
  });

  app.get("/api/classes/:id/members", async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await getMembership(app.db, id, req.user!.id);
    if (!me || me.status !== "active" || me.role === "student") {
      return reply.code(403).send({ error: "Teachers and assistants only." });
    }
    const rows = await app.db
      .select({ member: classMembers, user: users })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(eq(classMembers.classId, id));
    return {
      members: rows.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        role: r.member.role,
        status: r.member.status,
        joinedAt: r.member.createdAt.toISOString(),
      })),
    };
  });

  for (const action of ["approve", "deny"] as const) {
    app.post(`/api/classes/:id/members/:userId/${action}`, async (req, reply) => {
      const { id, userId } = req.params as { id: string; userId: string };
      try {
        await requireClassTeacher(app.db, id, req.user!.id);
      } catch (err) {
        if (await sendClassAuthError(reply, err)) return;
        throw err;
      }
      const target = await getMembership(app.db, id, userId);
      if (!target || target.status !== "waiting") {
        return reply.code(404).send({ error: "No waiting member to act on." });
      }
      await app.db.transaction(async (tx) => {
        if (action === "approve") {
          await tx
            .update(classMembers)
            .set({ status: "active" })
            .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        } else {
          await tx
            .delete(classMembers)
            .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        }
        await logEvent(
          tx,
          action === "approve" ? "class.join_approved" : "class.join_denied",
          req.user!.id,
          { classId: id, subject: userId },
        );
      });
      return { ok: true };
    });
  }

  app.delete("/api/classes/:id/members/:userId", async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    try {
      await app.db.transaction(async (tx) => {
        // Lock the class row so two concurrent removals in this class serialize
        // instead of both reading the active-teacher count before either deletes.
        await tx.execute(sql`SELECT id FROM classes WHERE id = ${id} FOR UPDATE`);
        const [target] = await tx
          .select()
          .from(classMembers)
          .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        if (!target) throw new MemberNotFound();
        if (target.role === "teacher" && target.status === "active") {
          const teachers = await tx
            .select()
            .from(classMembers)
            .where(
              and(
                eq(classMembers.classId, id),
                eq(classMembers.role, "teacher"),
                eq(classMembers.status, "active"),
              ),
            );
          if (teachers.length <= 1) throw new LastTeacher();
        }
        await tx
          .delete(classMembers)
          .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        await logEvent(tx, "member.removed", req.user!.id, { classId: id, subject: userId });
      });
    } catch (err) {
      if (err instanceof MemberNotFound) {
        return reply.code(404).send({ error: "Not a member of this class." });
      }
      if (err instanceof LastTeacher) {
        return reply.code(400).send({ error: "A class must keep at least one teacher." });
      }
      throw err;
    }
    return { ok: true };
  });
}

class MemberNotFound extends Error {}
class LastTeacher extends Error {}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
