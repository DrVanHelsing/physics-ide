import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { projects, projectVersions, users } from "../db/schema.js";
import { requireUser } from "../auth/guards.js";
import { logEvent } from "../db/events.js";

export const MAX_PROJECTS_PER_USER = 100;
export const MAX_MANIFEST_BYTES = 400 * 1024;
export const MAX_VERSIONS_PER_PROJECT = 20;

const PROJECT_ID_REGEX = /^p-[A-Za-z0-9-]{3,60}$/;

/** Just enough shape-checking to store it; the client owns full validation. */
const ManifestSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().regex(PROJECT_ID_REGEX),
    title: z.string().min(1).max(200),
    goal: z.string().min(1).max(40),
    projectType: z.string().min(1).max(40),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .passthrough();

async function pruneVersions(
  db: FastifyInstance["db"],
  ownerId: string,
  projectId: string,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM project_versions
    WHERE owner_id = ${ownerId} AND project_id = ${projectId}
      AND id NOT IN (
        SELECT id FROM project_versions
        WHERE owner_id = ${ownerId} AND project_id = ${projectId}
        ORDER BY id DESC LIMIT ${MAX_VERSIONS_PER_PROJECT}
      )
  `);
}

export function projectRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireUser);

  app.get("/api/projects", async (req) => {
    const rows = await app.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, req.user!.id));
    return {
      projects: rows.map((r) => ({
        id: r.id,
        title: r.title,
        goal: r.goal,
        projectType: r.projectType,
        clientUpdatedAt: r.clientUpdatedAt,
        deleted: r.deletedAt !== null,
      })),
    };
  });

  app.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
    const row = rows[0];
    if (!row || row.deletedAt) return reply.code(404).send({ error: "No such project." });
    return { project: { id: row.id, clientUpdatedAt: row.clientUpdatedAt, manifest: row.manifest } };
  });

  app.put("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { manifest?: unknown };
    const parsed = ManifestSchema.safeParse(body?.manifest);
    if (!parsed.success || parsed.data.id !== id || !PROJECT_ID_REGEX.test(id)) {
      return reply.code(400).send({ error: "That doesn't look like a valid project." });
    }
    const m = parsed.data;
    if (Buffer.byteLength(JSON.stringify(m), "utf8") > MAX_MANIFEST_BYTES) {
      return reply
        .code(413)
        .send({ error: "This project is too large to sync. Export it as a file instead." });
    }

    const result = await app.db.transaction(async (tx) => {
      // Updates serialize on the head row lock; creations lock the owner row
      // below so two concurrent first-pushes cannot race past the cap check.
      const existing = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = existing[0];

      if (!head) {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, req.user!.id))
          .for("update");
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(and(eq(projects.ownerId, req.user!.id), sql`deleted_at IS NULL`));
        if (count >= MAX_PROJECTS_PER_USER) return { kind: "cap" as const };
        await tx.insert(projects).values({
          id,
          ownerId: req.user!.id,
          title: m.title,
          goal: m.goal,
          projectType: m.projectType,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
        });
        return { kind: "saved" as const };
      }

      if (!head.deletedAt && m.updatedAt < head.clientUpdatedAt) {
        // Incoming is stale: archive the LOSER, keep the head (spec §15.2 + §6.3 history).
        await tx.insert(projectVersions).values({
          ownerId: req.user!.id,
          projectId: id,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
          savedBy: req.user!.id,
          reason: "conflict-loser",
        });
        return { kind: "kept-remote" as const, head };
      }

      if (m.updatedAt !== head.clientUpdatedAt || head.deletedAt) {
        // Newer (or reviving a tombstone): archive the PREVIOUS head, then overwrite.
        await tx.insert(projectVersions).values({
          ownerId: req.user!.id,
          projectId: id,
          manifest: head.manifest,
          clientUpdatedAt: head.clientUpdatedAt,
          savedBy: req.user!.id,
          reason: "overwrite",
        });
      } else {
        return { kind: "saved" as const }; // equal-ms idempotent re-push: nothing to do
      }
      await tx
        .update(projects)
        .set({
          title: m.title,
          goal: m.goal,
          projectType: m.projectType,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      return { kind: "saved" as const };
    });

    if (result.kind === "cap") {
      return reply
        .code(403)
        .send({ error: "You've reached the 100-project limit — delete something first." });
    }
    await pruneVersions(app.db, req.user!.id, id);
    if (result.kind === "kept-remote") {
      return {
        outcome: "kept-remote",
        project: {
          id,
          clientUpdatedAt: result.head.clientUpdatedAt,
          manifest: result.head.manifest,
        },
      };
    }
    return { outcome: "saved" };
  });

  app.delete("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = rows[0];
      if (!head || head.deletedAt) return; // idempotent
      await tx.insert(projectVersions).values({
        ownerId: req.user!.id,
        projectId: id,
        manifest: head.manifest,
        clientUpdatedAt: head.clientUpdatedAt,
        savedBy: req.user!.id,
        reason: "overwrite",
      });
      await tx
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      await logEvent(tx, "project.deleted", req.user!.id, { projectId: id });
    });
    void reply;
    return { ok: true };
  });
}
