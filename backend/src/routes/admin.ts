import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, inArray, isNotNull, ne, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  users,
  emails,
  emailTokens,
  classes,
  classMembers,
  groups,
  groupMembers,
  notifications,
  notificationPrefs,
  projects,
  projectVersions,
  assignments,
  assignmentWork,
  submissions,
  marks,
  ruleSets,
  guides,
  invites,
  shares,
  events,
} from "../db/schema.js";
import { getSetting, setSetting } from "../db/settings.js";
import { requireAdmin } from "../auth/guards.js";
import { destroyAllUserSessions } from "../auth/session.js";
import { logEvent } from "../db/events.js";
import { newToken } from "../auth/tokens.js";
import { confirmEmail, resetEmail } from "../email/templates.js";
import { config } from "../config.js";
import { ERASED_NAME } from "../lib/util.js";
import { toAuthUser, CONFIRM_TTL_MS, RESET_TTL_MS } from "./auth.js";
import { toMyMark } from "./assignments.js";

const CapSchema = z.object({ cap: z.number().int().min(1).max(10000) });
/** The erase confirmation is the account's CURRENT email typed back — the
 *  reversible neighbour (Deactivate) is one button away, and email is the
 *  UNIQUE column (design D§5). */
const EraseSchema = z.object({ confirm: z.string() });

/* Every refusal is a named sentence, asserted verbatim by admin.test.ts
 * and the authority matrix — the assignments.ts/shares.ts idiom. */
const NO_SUCH_ACCOUNT = "No such account.";
const ALREADY_ERASED = "They have already been erased.";
const SELF_ERASE = "You can't erase your own account.";
const CONFIRM_MISMATCH = "The confirmation doesn't match this account's email.";

export function adminRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/users", async (req) => {
    const q = (req.query as { q?: string }).q?.trim();
    const base = app.db.select().from(users);
    const rows = q
      ? await base.where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
      : await base;
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      users: rows.slice(0, 200).map((u) => ({
        ...toAuthUser(u),
        active: u.active,
        // The People tab's THIRD status (D§5) — a scrubbed shell is not a
        // deactivated account, and offering "Reactivate" on one would be a
        // lie. `erasedAt` is the only column that tells them apart.
        erased: u.erasedAt !== null,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/admin/users/:id/deactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account." });
    }
    const [u] = await app.db.update(users).set({ active: false }).where(eq(users.id, id)).returning();
    if (!u) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    await destroyAllUserSessions(app.db, id);
    await logEvent(app.db, "account.deactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/reactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    // Read before write: flipping `active` first and checking `erasedAt`
    // after would briefly revive an erased shell (Task 9 review, binding).
    const [existing] = await app.db.select().from(users).where(eq(users.id, id));
    if (!existing) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    if (existing.erasedAt) return reply.code(409).send({ error: ALREADY_ERASED });
    await app.db.update(users).set({ active: true }).where(eq(users.id, id));
    await logEvent(app.db, "account.reactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/resend-confirmation", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    if (u.emailConfirmedAt) {
      return reply.code(400).send({ error: "That account is already confirmed." });
    }
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "confirm",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    });
    const mail = confirmEmail({
      name: u.name,
      confirmUrl: `${config.appBaseUrl}/auth/confirm?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "confirm", ...mail });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/send-reset", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    // Task 9 review (binding): an erased shell must not be handed a live
    // reset link — the same refusal `erase` itself gives a second attempt.
    if (u.erasedAt) return reply.code(409).send({ error: ALREADY_ERASED });
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "reset",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const mail = resetEmail({
      name: u.name,
      resetUrl: `${config.appBaseUrl}/auth/reset?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "reset", ...mail });
    return { ok: true };
  });

  /* ═══ Erasure — an in-place PII SCRUB, never `DELETE FROM users` (D§5).
   *
   * Three reasons, each sufficient: a hard delete on any teacher who ever
   * created a class/assignment/guide/invite raises a bare FK violation
   * (four `no action` FKs, no cleanup path); the cascade FKs on
   * `submissions.submitterId` and `marks.studentId` would delete the very
   * history spec §11 says survives; and `active=false` already locks every
   * door (session.ts, signin, forgot) with zero new checks.
   *
   * So: the class RECORD survives — memberships, submissions, marks and
   * the append-only events ledger are untouched, and every `users.name`
   * join in the tree renders "Removed student" through the surviving row.
   * The PERSON does not: identifying columns overwritten, delivery state
   * deleted, their own work deleted, the group's shared workspace spared.
   *
   * ONE transaction, guards first, `.for("update")` on the subject so two
   * concurrent erases cannot both pass the already-erased check. ═══ */
  app.post("/api/admin/users/:id/erase", async (req, reply) => {
    // A malformed id cannot exist — same posture as missing, never a 500.
    const idParsed = z.string().uuid().safeParse((req.params as { id: string }).id);
    if (!idParsed.success) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    const id = idParsed.data;

    type Outcome = "missing" | "self" | "mismatch" | "already" | "erased";

    const outcome: Outcome = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(users).where(eq(users.id, id)).for("update");
      const u = rows[0];
      if (!u) return "missing" as const;
      if (u.id === req.user!.id) return "self" as const;
      // Confirm BEFORE already-erased: an admin can never act on an
      // account without naming the email it carries NOW, not even to be
      // told the work was already done.
      const parsed = EraseSchema.safeParse(req.body ?? {});
      const confirmed =
        parsed.success && parsed.data.confirm.trim().toLowerCase() === u.email.trim().toLowerCase();
      if (!confirmed) return "mismatch" as const;
      if (u.erasedAt) return "already" as const;

      // 1. The scrub. `id`, `consentAt` and `createdAt` stay: consent and
      //    account age are the record of a decision, not a detail about
      //    the person. The sentinel email is NOT NULL + UNIQUE by
      //    construction and RFC 2606 undeliverable.
      await tx
        .update(users)
        .set({
          name: ERASED_NAME,
          email: `erased+${u.id}@erased.invalid`,
          passwordHash: "",
          role: "user",
          isTeacher: false,
          emailConfirmedAt: null,
          active: false,
          erasedAt: new Date(),
        })
        .where(eq(users.id, u.id));

      // 2. Every live door. The tx is passed straight through — a session
      //    must not outlive the scrub by even one statement.
      await destroyAllUserSessions(tx, u.id);
      // EXPLICIT: the `email_tokens` cascade never fires under a scrub, and
      // a live reset link must not outlive the erasure.
      await tx.delete(emailTokens).where(eq(emailTokens.userId, u.id));
      // Delivery state, not history — the same reason `notifications` sits
      // beside the ledger instead of inside it (D§2).
      await tx.delete(notifications).where(eq(notifications.userId, u.id));
      await tx.delete(notificationPrefs).where(eq(notificationPrefs.userId, u.id));
      // The email log's debt. `emails.toUserId` carries no FK (schema.ts),
      // so nothing here cascades: without this an erased person's real
      // address stays in `to_email`, and `body_text` keeps whatever the
      // templates interpolated — which the `token=` redaction does not
      // touch — and the export still hands those rows back. The log is
      // operational, not a record (D§5 fiat 7), so it has no claim to
      // survive an erasure. Seam-level suppression closes FUTURE sends;
      // this is the half suppression cannot reach.
      //
      // Matched on the ADDRESS as well as the id, and the address arm is not
      // redundant: BOTH invite sends (invites.ts:79 and :183) pass only
      // `to:`, because an invitation is sent before the recipient has an
      // account — so every invite ever mailed to this person carries a NULL
      // `to_user_id` and would otherwise survive the erasure with their real
      // address in it. For a student those are the likeliest rows to exist.
      // `u` is the snapshot taken by the `for("update")` select at the top of
      // this transaction, so `u.email` is still the REAL address here even
      // though the scrub above has already written the sentinel; and
      // `users.email` is UNIQUE, so the address arm cannot reach anyone else.
      await tx.delete(emails).where(or(eq(emails.toUserId, u.id), eq(emails.toEmail, u.email)));
      // class_members and group_members are DELIBERATELY KEPT: the marking
      // inbox and the gradebook build their rosters from membership, so
      // deleting them would make the surviving submissions and marks
      // invisible — §11's "the marks history stays intact", broken at the
      // view level. The one consequence is closed in shares.ts, where the
      // person-facing recipient picker filters on `erasedAt`.

      // 3. Their own work goes; the group's does not (D§5 fiat 7). A
      //    `groups.projectId` row marks a project as the group's shared
      //    workspace — erasing one member must not destroy it. Matched on
      //    BOTH columns, the shares.ts group-project test's idiom: project
      //    ids are client-minted strings, so `projectId` alone could spare
      //    an unrelated project of theirs that happens to share a name.
      const linked = await tx
        .select({ projectId: groups.projectId })
        .from(groups)
        .where(and(eq(groups.ownerId, u.id), isNotNull(groups.projectId)));
      const keep = linked.map((g) => g.projectId!);
      // project_versions and assignment_work follow by composite cascade.
      await tx
        .delete(projects)
        .where(
          keep.length
            ? and(eq(projects.ownerId, u.id), notInArray(projects.id, keep))
            : eq(projects.ownerId, u.id),
        );

      // 4. Delivery state on the shares table — never the accepted copies,
      //    which are the recipients' OWN projects (D§8's promise).
      await tx
        .delete(shares)
        .where(and(eq(shares.sharerId, u.id), eq(shares.status, "pending")));
      await tx
        .update(shares)
        .set({ frozenManifest: {} })
        .where(and(eq(shares.sharerId, u.id), ne(shares.status, "pending")));
      // A recipient who can never accept must not hold deliveries open.
      await tx
        .delete(shares)
        .where(and(eq(shares.recipientId, u.id), eq(shares.status, "pending")));

      // 5. The ledger row, in the same transaction as the mutation it
      //    records. Ids only — the payload never names the person.
      await logEvent(tx, "account.erased", req.user!.id, { subject: id });
      return "erased" as const;
    });

    if (outcome === "missing") return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    if (outcome === "self") return reply.code(400).send({ error: SELF_ERASE });
    if (outcome === "mismatch") return reply.code(400).send({ error: CONFIRM_MISMATCH });
    if (outcome === "already") return reply.code(409).send({ error: ALREADY_ERASED });
    return { ok: true };
  });

  /* ═══ Export — D§6: an ordinary JSON body, everything theirs, their own
   * audit trail and nobody else's. The admin console turns this into a
   * download with the existing Blob + a.download idiom (the gradebook CSV
   * precedent) — no `Content-Disposition`, no zip, no streaming, no file
   * infrastructure (the contract's clause stays intact). GET is
   * deliberate: it adds no authority-matrix row.
   *
   * `events` is filtered on `actorId = :id` ONLY — rows *about* them
   * (overwhelmingly a teacher's `timeline_viewed`) are someone else's
   * action, not theirs, and the export's own header text says so. ═══ */
  const EXPORT_NOTE =
    "This export contains your account, your work, and the actions you took. " +
    "It does not contain other people's actions — including a teacher's record of viewing your work.";

  app.get("/api/admin/users/:id/export", async (req, reply) => {
    // Same posture as erase: a malformed id cannot exist — never a 500.
    const idParsed = z.string().uuid().safeParse((req.params as { id: string }).id);
    if (!idParsed.success) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });
    const id = idParsed.data;

    const [u] = await app.db.select().from(users).where(eq(users.id, id));
    if (!u) return reply.code(404).send({ error: NO_SUCH_ACCOUNT });

    // Fetched ahead of the batch below: `assignmentWork`'s group-mode rows
    // (review finding 2) are keyed by `groupId`, never `userId`, so the
    // groups THEY belong to have to be known before that query is built.
    const groupMembershipRows = await app.db.select().from(groupMembers).where(eq(groupMembers.userId, id));
    const memberGroupIds = groupMembershipRows.map((g) => g.groupId);

    const [
      classMembershipRows,
      projectRows,
      projectVersionRows,
      assignmentWorkRows,
      submissionRows,
      markRows,
      groupRows,
      ruleSetRows,
      sharesSentRows,
      sharesReceivedRows,
      authoredClassRows,
      authoredAssignmentRows,
      authoredGuideRows,
      sentInviteRows,
      emailRows,
      eventRows,
    ] = await Promise.all([
      app.db.select().from(classMembers).where(eq(classMembers.userId, id)),
      app.db.select().from(projects).where(eq(projects.ownerId, id)),
      app.db.select().from(projectVersions).where(eq(projectVersions.ownerId, id)),
      // Review finding 2: a group-mode row never carries `userId` — it's
      // theirs iff it's one of the groups the membership rows above name.
      app.db
        .select()
        .from(assignmentWork)
        .where(
          memberGroupIds.length
            ? or(eq(assignmentWork.userId, id), inArray(assignmentWork.groupId, memberGroupIds))
            : eq(assignmentWork.userId, id),
        ),
      // Review finding 2: the CREDIT authority, not the submitter column —
      // a group submission's `submitterId` is null, and `creditedIds` is
      // the record of who is actually credited (a later group joiner who
      // never got credited must NOT see a submission that isn't theirs).
      app.db
        .select()
        .from(submissions)
        .where(
          or(
            eq(submissions.submitterId, id),
            sql`${submissions.creditedIds} @> ${JSON.stringify([id])}::jsonb`,
          ),
        ),
      app.db.select().from(marks).where(eq(marks.studentId, id)),
      app.db.select().from(groups).where(eq(groups.ownerId, id)),
      app.db.select().from(ruleSets).where(eq(ruleSets.ownerId, id)),
      app.db.select().from(shares).where(eq(shares.sharerId, id)),
      app.db.select().from(shares).where(eq(shares.recipientId, id)),
      app.db.select().from(classes).where(eq(classes.createdBy, id)),
      app.db.select().from(assignments).where(eq(assignments.createdBy, id)),
      app.db.select().from(guides).where(eq(guides.createdBy, id)),
      app.db.select().from(invites).where(eq(invites.invitedBy, id)),
      app.db.select().from(emails).where(eq(emails.toUserId, id)),
      app.db.select().from(events).where(eq(events.actorId, id)),
    ]);

    return {
      note: EXPORT_NOTE,
      user: {
        ...toAuthUser(u),
        createdAt: u.createdAt.toISOString(),
        consentAt: u.consentAt.toISOString(),
      },
      classMemberships: classMembershipRows,
      projects: projectRows,
      // Metadata only (D§6's bounded-size fiat) — never the manifest.
      projectVersions: projectVersionRows.map((v) => ({
        id: v.id,
        label: v.reason,
        createdAt: v.createdAt.toISOString(),
      })),
      assignmentWork: assignmentWorkRows,
      submissions: submissionRows,
      // Review finding 1: shaped to the SAME student-facing boundary the
      // in-app read uses (`toMyMark`, assignments.ts) — released/returned
      // rows only, and `privateNote` is never read into the shape at all,
      // by construction, not by field-level omission after a raw select.
      marksReceived: markRows.flatMap((m) => {
        const shaped = toMyMark(m);
        return shaped ? [{ id: m.id, assignmentId: m.assignmentId, ...shaped }] : [];
      }),
      groups: groupRows,
      groupMemberships: groupMembershipRows,
      ruleSets: ruleSetRows,
      sharesSent: sharesSentRows,
      sharesReceived: sharesReceivedRows,
      authoredClasses: authoredClassRows,
      authoredAssignments: authoredAssignmentRows,
      authoredGuides: authoredGuideRows,
      sentInvites: sentInviteRows,
      emails: emailRows,
      events: eventRows,
    };
  });

  app.get("/api/admin/cap", async () => {
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    const [{ count }] = await app.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return { cap, count };
  });

  app.put("/api/admin/cap", async (req, reply) => {
    const parsed = CapSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "cap must be a whole number ≥ 1." });
    await setSetting(app.db, "account_cap", parsed.data.cap);
    await logEvent(app.db, "settings.cap_changed", req.user!.id, { cap: parsed.data.cap });
    return { ok: true, cap: parsed.data.cap };
  });

  app.get("/api/admin/emails", async (req) => {
    // Final review I2 (mirrored, admin-only): the same fractional hole as
    // notifications.ts's limit — a non-integer (e.g. "1.5") reached the DB
    // as an invalid bigint literal. Only a positive integer clamps in;
    // anything else (negative, zero, fractional, missing, non-numeric)
    // falls back to the default page size.
    const limitRaw = Number((req.query as { limit?: string }).limit ?? 100);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const rows = await app.db.select().from(emails).orderBy(desc(emails.id)).limit(limit);
    return {
      emails: rows.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        template: e.template,
        subject: e.subject,
        bodyText: e.bodyText,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  app.get("/api/admin/health", async () => {
    const [{ count: userCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: emailCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails);
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    // §10's second promise for this panel: "storage used". Node-postgres
    // returns a bigint column as a string, not a number — Number() is safe
    // at this project's 200-user scale (well under Number.MAX_SAFE_INTEGER).
    const sizeResult = await app.db.execute<{ bytes: string }>(
      sql`SELECT pg_database_size(current_database()) AS bytes`,
    );
    const storageBytes = Number(sizeResult.rows[0]?.bytes ?? 0);
    return { ok: true, db: "ok", users: userCount, cap, emailsLogged: emailCount, storageBytes };
  });

  app.get("/api/admin/classes", async () => {
    const rows = await app.db.select().from(classes);
    const members = await app.db
      .select({ member: classMembers, user: users })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id));
    return {
      classes: rows.map((c) => {
        const mine = members.filter((m) => m.member.classId === c.id);
        return {
          id: c.id,
          name: c.name,
          subjectLabel: c.subjectLabel,
          archived: c.archived,
          joinMode: c.joinMode,
          activeMembers: mine.filter((m) => m.member.status === "active").length,
          teachers: mine
            .filter((m) => m.member.role === "teacher" && m.member.status === "active")
            .map((m) => m.user.name),
        };
      }),
    };
  });
}
