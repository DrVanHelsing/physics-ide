import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { GuideInputSchema } from "@physics-ide/shared";
import { guides } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import {
  getMembership,
  isStaffRole,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";
import { toEpoch } from "../lib/util.js";

type GuideRow = typeof guides.$inferSelect;

const NOT_A_MEMBER = "Not a member of this class.";
const NO_SUCH_GUIDE = "No such guide.";

export function toGuideSummary(g: GuideRow, extras: Record<string, unknown> = {}) {
  return {
    id: g.id,
    classId: g.classId,
    title: g.title,
    publishedAt: toEpoch(g.publishedAt),
    ...extras,
  };
}

/** Students see a guide only once it is published — same "existence not
 *  admitted" treatment a draft assignment gets (spec §5.1 / this plan §4).
 *  Named guideVisibleToStudent, not visibleToStudent, to keep this a
 *  DIFFERENT predicate from lib/util.ts's assignment-shaped one — same name,
 *  different row, never merged (design D§14.10). */
function guideVisibleToStudent(g: GuideRow): boolean {
  return g.publishedAt != null;
}

async function loadGuide(db: Db, id: string): Promise<GuideRow | null> {
  const rows = await db.select().from(guides).where(eq(guides.id, id));
  return rows[0] ?? null;
}

const UpdateGuideInputSchema = GuideInputSchema.partial();

export function guideRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/:id/guides", async (req, reply) => {
    const { id: classId } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = GuideInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    const created = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(guides)
        .values({ classId, createdBy: req.user!.id, title: d.title, body: d.body })
        .returning();
      await logEvent(tx, "guide.created", req.user!.id, { guideId: row.id, classId });
      return row;
    });
    return reply.code(201).send({ guide: toGuideSummary(created) });
  });

  app.get("/api/classes/:id/guides", async (req, reply) => {
    const { id: classId } = req.params as { id: string };
    const m = await getMembership(app.db, classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    const rows = await app.db.select().from(guides).where(eq(guides.classId, classId));

    if (!isStaffRole(m.role)) {
      return { guides: rows.filter(guideVisibleToStudent).map((g) => toGuideSummary(g)) };
    }
    return { guides: rows.map((g) => toGuideSummary(g)) };
  });

  app.get("/api/guides/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const g = await loadGuide(app.db, id);
    if (!g) return reply.code(404).send({ error: NO_SUCH_GUIDE });
    const m = await getMembership(app.db, g.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    const staff = isStaffRole(m.role);
    if (!staff && !guideVisibleToStudent(g)) {
      return reply.code(404).send({ error: NO_SUCH_GUIDE });
    }
    return { guide: toGuideSummary(g, { body: g.body }) };
  });

  app.patch("/api/guides/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const g = await loadGuide(app.db, id);
    if (!g) return reply.code(404).send({ error: NO_SUCH_GUIDE });
    try {
      await requireClassTeacher(app.db, g.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = UpdateGuideInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    const patch: Partial<typeof guides.$inferInsert> = {};
    if (d.title !== undefined) patch.title = d.title;
    if (d.body !== undefined) patch.body = d.body;

    if (Object.keys(patch).length === 0) return { guide: toGuideSummary(g, { body: g.body }) };

    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(guides)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(guides.id, id))
        .returning();
      await logEvent(tx, "guide.updated", req.user!.id, { guideId: id, patch: d });
      return row;
    });
    return { guide: toGuideSummary(updated, { body: updated.body }) };
  });

  app.post("/api/guides/:id/publish", async (req, reply) => {
    const { id } = req.params as { id: string };
    const g = await loadGuide(app.db, id);
    if (!g) return reply.code(404).send({ error: NO_SUCH_GUIDE });
    try {
      await requireClassTeacher(app.db, g.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (g.publishedAt != null) {
      return reply.code(400).send({ error: "This guide is already published." });
    }
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(guides)
        .set({ publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(guides.id, id))
        .returning();
      await logEvent(tx, "guide.published", req.user!.id, { guideId: id });
      return row;
    });
    return { guide: toGuideSummary(updated) };
  });

  // Guides carry no student work (unlike a published assignment, which only
  // ever closes) — a teacher may delete one at any point in its life.
  app.delete("/api/guides/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const g = await loadGuide(app.db, id);
    if (!g) return reply.code(404).send({ error: NO_SUCH_GUIDE });
    try {
      await requireClassTeacher(app.db, g.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    await app.db.transaction(async (tx) => {
      await tx.delete(guides).where(eq(guides.id, id));
      await logEvent(tx, "guide.deleted", req.user!.id, { guideId: id, classId: g.classId });
    });
    return reply.code(204).send();
  });
}
