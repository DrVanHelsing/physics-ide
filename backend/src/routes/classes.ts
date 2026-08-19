import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CreateClassInputSchema,
  UpdateClassSettingsInputSchema,
} from "@physics-ide/shared";
import { classes, classMembers } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { generateClassCode } from "../classes/codes.js";
import {
  getMembership,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";

type ClassRow = typeof classes.$inferSelect;

function toClassSummary(row: ClassRow, myRole: string | null, includeCode: boolean) {
  return {
    id: row.id,
    name: row.name,
    subjectLabel: row.subjectLabel,
    joinMode: row.joinMode,
    archived: row.archived,
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
    const created = await app.db.transaction(async (tx) => {
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
          ...toClassSummary(c, m.role, m.role === "teacher"),
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
        ...toClassSummary(c, m.role, m.role === "teacher"),
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
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx.update(classes).set(patch).where(eq(classes.id, id)).returning();
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
        await tx.update(classes).set({ archived }).where(eq(classes.id, id));
        await logEvent(tx, archived ? "class.archived" : "class.unarchived", req.user!.id, {
          classId: id,
        });
      });
      return { ok: true, archived };
    });
  }
}
