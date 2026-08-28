import type { FastifyError, FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { projects, projectVersions, users } from "../db/schema.js";
import { requireUser } from "../auth/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";

export const MAX_PROJECTS_PER_USER = 100;
export const MAX_MANIFEST_BYTES = 400 * 1024;
export const MAX_VERSIONS_PER_PROJECT = 20;

const PROJECT_ID_REGEX = /^p-[A-Za-z0-9-]{3,60}$/;

export const OVERSIZE_ERROR = "This project is too large to sync. Export it as a file instead.";
export const INVALID_PROJECT_ERROR = "That doesn't look like a valid project.";
const CAP_ERROR = "You've reached the 100-project limit — delete something first.";

/** Just enough shape-checking to store it; the client owns full validation.
 *  Exported for the group project PUT (plan Stage D): a group's shared
 *  project IS one of these rows, and the founding member's own sync engine
 *  reads back whatever a member saves into it — so a group save is held to
 *  exactly the contract the owner's own push is held to, from one schema. */
export const ManifestSchema = z
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

/**
 * Canonical JSON: object keys sorted recursively. Postgres jsonb does not preserve
 * key order, so a plain JSON.stringify comparison of a round-tripped manifest against
 * the freshly-parsed incoming one could report "different" for two objects that are
 * actually equal — this comparison is immune to that.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Exported for the group project PUT (plan Stage D): a group's shared
 *  project is an ordinary project row and stays under the same history
 *  bound as every other one, rather than growing a copy per group save. */
export async function pruneVersions(db: Db, ownerId: string, projectId: string): Promise<void> {
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

/**
 * §15.7 "fatal for abuse" bound: a create/delete loop must not grow tombstones
 * without limit while the live count stays at (or near) zero. Keeps this owner's
 * newest MAX_PROJECTS_PER_USER tombstoned rows and hard-deletes the rest — the
 * composite FK cascade takes their version history with them. Non-abusive accounts
 * (well under the cap) never have enough tombstones to hit this.
 */
async function pruneTombstones(db: Pick<Db, "execute">, ownerId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM projects
    WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
      AND id NOT IN (
        SELECT id FROM projects
        WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC LIMIT ${MAX_PROJECTS_PER_USER}
      )
  `);
}

/**
 * Locks the owner's row and reports whether they're already at the live-project cap.
 * Shared by the create path and the tombstone-revive path so neither can bypass it —
 * reviving a tombstone re-adds a live project, same as creating one from scratch.
 */
async function isAtCap(tx: Pick<Db, "select">, ownerId: string): Promise<boolean> {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).for("update");
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), sql`deleted_at IS NULL`));
  return count >= MAX_PROJECTS_PER_USER;
}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause.
 *  Same private-per-file idiom auth.ts, members.ts and assignments.ts use. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

export function projectRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireUser);

  // Scoped to this plugin's encapsulation context: a manifest whose serialized body
  // exceeds Fastify's default 1 MiB bodyLimit never reaches the route handler, so the
  // MAX_MANIFEST_BYTES check below can't produce the exact oversize sentence for it —
  // catch that specific error here and give the same byte-exact message. Everything
  // else falls through to normal handling.
  app.setErrorHandler<FastifyError>((err, _req, reply) => {
    if (err.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send({ error: OVERSIZE_ERROR });
    }
    return reply.send(err);
  });

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
      return reply.code(400).send({ error: INVALID_PROJECT_ERROR });
    }
    const m = parsed.data;
    if (Buffer.byteLength(JSON.stringify(m), "utf8") > MAX_MANIFEST_BYTES) {
      return reply.code(413).send({ error: OVERSIZE_ERROR });
    }

    const result = await app.db.transaction(async (tx) => {
      // Updates serialize on the head row lock; creations (and revives, which also
      // add a live project) lock the owner row via isAtCap so concurrent pushes
      // cannot race past the cap check.
      const readHead = async () => {
        const rows = await tx
          .select()
          .from(projects)
          .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
          .for("update");
        return rows[0];
      };
      let head = await readHead();

      if (!head) {
        if (await isAtCap(tx, req.user!.id)) return { kind: "cap" as const };
        // `FOR UPDATE` locks nothing when the row does not exist yet, so two
        // concurrent FIRST pushes of one new id both arrive here — which is
        // not hypothetical: pressing "Start work" fires startWork's own
        // explicit push and SyncProvider's auto-adopt of the same freshly
        // saved project a millisecond or two apart. The composite primary key
        // is the real guard, and the loser's 23505 used to escape as a 500,
        // read by the IDE as "Could not reach the server" on a Start that had
        // in fact worked. It is caught here instead: the winner's head is
        // re-read and the push carries on down the ordinary update path
        // below, where `clientUpdatedAt` decides between the two exactly as
        // it does for any other pair of pushes.
        //
        // The insert runs inside its own SAVEPOINT (drizzle's nested
        // transaction) — a unique violation aborts the statement's savepoint,
        // not the whole transaction, so there is something left to carry on
        // WITH. And by the time 23505 is raised the winning row is committed:
        // the insert blocks on the unique index until the other writer
        // settles, so the re-read below always finds it.
        let created = true;
        try {
          await tx.transaction(async (sp) => {
            await sp.insert(projects).values({
              id,
              ownerId: req.user!.id,
              title: m.title,
              goal: m.goal,
              projectType: m.projectType,
              manifest: m,
              clientUpdatedAt: m.updatedAt,
            });
          });
        } catch (err) {
          if (pgErrorCode(err) !== "23505") throw err;
          created = false;
        }
        if (created) return { kind: "saved" as const };
        head = await readHead();
        if (!head) return { kind: "saved" as const }; // vanished again: nothing left to reconcile against
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

      // Equal-ms ties count as newer — nothing may be silently dropped. Only an EXACT
      // content match (compared canonically; jsonb doesn't preserve key order) is a
      // true no-op. A live head with equal ms but different content falls through to
      // the overwrite branch below, same as a strictly-newer push.
      if (
        !head.deletedAt &&
        m.updatedAt === head.clientUpdatedAt &&
        stableStringify(m) === stableStringify(head.manifest)
      ) {
        return { kind: "saved" as const }; // identical re-push: nothing to do
      }

      if (head.deletedAt && (await isAtCap(tx, req.user!.id))) {
        // Reviving would re-add a live project — same cap as creating one.
        return { kind: "cap" as const };
      }

      // Newer, reviving a tombstone, or an equal-ms tie with different content:
      // archive the PREVIOUS head, then overwrite.
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
      return reply.code(403).send({ error: CAP_ERROR });
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
      // §15.7 abuse bound: keep this owner's tombstone count in check (see pruneTombstones).
      await pruneTombstones(tx, req.user!.id);
    });
    void reply;
    return { ok: true };
  });

  app.get("/api/projects/:id/versions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const heads = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
    if (!heads[0]) return reply.code(404).send({ error: "No such project." });
    const rows = await app.db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, req.user!.id), eq(projectVersions.projectId, id)))
      .orderBy(desc(projectVersions.id));
    return {
      versions: rows.map((v) => ({
        versionId: v.id,
        clientUpdatedAt: v.clientUpdatedAt,
        reason: v.reason,
        savedAt: v.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/projects/:id/versions/:versionId/restore", async (req, reply) => {
    const { id, versionId } = req.params as { id: string; versionId: string };
    const vid = Number(versionId);
    if (!Number.isInteger(vid)) return reply.code(404).send({ error: "No such version." });
    const now = Date.now();
    // A discriminated result distinguishes "no such version" (404) from "refused by
    // the cap" (403) — reviving a tombstoned head re-adds a live project, so it must
    // be checked against the same cap as PUT's tombstone-revive path (isAtCap).
    const result = await app.db.transaction(async (tx) => {
      const heads = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = heads[0];
      if (!head) return { kind: "not-found" as const };
      const versions = await tx
        .select()
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.id, vid),
            eq(projectVersions.ownerId, req.user!.id),
            eq(projectVersions.projectId, id),
          ),
        );
      const version = versions[0];
      if (!version) return { kind: "not-found" as const };

      if (head.deletedAt && (await isAtCap(tx, req.user!.id))) {
        // Restoring a live project never touches the cap; reviving a tombstoned
        // one does, same as PUT's revive path.
        return { kind: "cap" as const };
      }

      await tx.insert(projectVersions).values({
        ownerId: req.user!.id,
        projectId: id,
        manifest: head.manifest,
        clientUpdatedAt: head.clientUpdatedAt,
        savedBy: req.user!.id,
        reason: "restore",
      });
      const restored: Record<string, unknown> = {
        ...(version.manifest as Record<string, unknown>),
        updatedAt: now,
      };
      await tx
        .update(projects)
        .set({
          manifest: restored,
          clientUpdatedAt: now,
          title: (restored.title as string) ?? head.title,
          goal: (restored.goal as string) ?? head.goal,
          projectType: (restored.projectType as string) ?? head.projectType,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      await logEvent(tx, "project.restored", req.user!.id, { projectId: id, versionId: vid });
      return { kind: "restored" as const };
    });
    if (result.kind === "not-found") return reply.code(404).send({ error: "No such version." });
    if (result.kind === "cap") return reply.code(403).send({ error: CAP_ERROR });
    await pruneVersions(app.db, req.user!.id, id);
    return { ok: true, clientUpdatedAt: now };
  });
}
