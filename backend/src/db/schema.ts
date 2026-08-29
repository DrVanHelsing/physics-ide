import { pgTable, text, jsonb, bigserial, uuid, timestamp, boolean, unique, uniqueIndex, bigint, primaryKey, index, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Admin-adjustable switches — first row: account_cap = 200 (spec §3.1). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Append-only audit trail (spec §8). Never updated, never deleted. */
export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: text("type").notNull(),
  actorId: uuid("actor_id"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Accounts (spec §2, §3.1). role: "user" | "admin"; teachers are users with isTeacher. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  isTeacher: boolean("is_teacher").notNull().default(false),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  /** Plan 8 (spec §11, design D§5): set by the admin erase route's in-place
   *  scrub — the ONLY way to tell an erased row from a deactivated one.
   *  Erasure never deletes this row: hard delete would cascade away the
   *  submissions and marks §11 keeps, and bare-FK-fail on any teacher. */
  erasedAt: timestamp("erased_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Server-side sessions (stack §3). Cookie carries the raw token; we store its SHA-256. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Single-use expiring tokens for email confirm / password reset (stack §3). */
export const emailTokens = pgTable("email_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every email the system "sends" — the dev pretend inbox and the future email log (spec §9). */
export const emails = pgTable("emails", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  toEmail: text("to_email").notNull(),
  toUserId: uuid("to_user_id"),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  status: text("status").notNull().default("dev"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Classrooms (spec §4). joinMode: "open" | "approval" | "paused". */
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subjectLabel: text("subject_label"),
  joinCode: text("join_code").notNull().unique(),
  joinMode: text("join_mode").notNull().default("open"),
  /** Spec §8.3's class-level switch — peer sharing on or off for the whole
   *  class, OFF by default. Flipping it off lapses pending shares (D§8). */
  peerSharing: boolean("peer_sharing").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who is in a class, wearing which hat (spec §2). status: "active" | "waiting". */
export const classMembers = pgTable(
  "class_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("class_members_class_user_uq").on(t.classId, t.userId)],
);

/** Pending email invites (spec §3.3.1). status: "pending" | "accepted" | "revoked". */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("pending"),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  acceptedBy: uuid("accepted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cloud copies of local-first projects (spec §6.3). id is CLIENT-minted; pk is (owner, id). */
export const projects = pgTable(
  "projects",
  {
    id: text("id").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    projectType: text("project_type").notNull(),
    manifest: jsonb("manifest").notNull(),
    /** The manifest's own updatedAt (epoch ms) — the most-recent-wins key (spec §15.2). */
    clientUpdatedAt: bigint("client_updated_at", { mode: "number" }).notNull(),
    /** Plan 7 (spec §8.1): { sharerId, shareId } — set at share-accept,
     *  null for every other project. IDS ONLY: the sharer's name is
     *  resolved at read time so §11 erasure has one place to act. Never
     *  copied into the manifest (contract D§2 — the manifest is never
     *  tagged) and deliberately NOT an FK: an erased sharer must not
     *  delete or block on the recipient's copy. */
    attribution: jsonb("attribution"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);

/** Append-only history: overwritten heads, conflict losers, restore snapshots (spec §6.3/§8.1). */
export const projectVersions = pgTable(
  "project_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    manifest: jsonb("manifest").notNull(),
    clientUpdatedAt: bigint("client_updated_at", { mode: "number" }).notNull(),
    savedBy: uuid("saved_by").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_versions_owner_project_idx").on(t.ownerId, t.projectId),
    foreignKey({
      columns: [t.ownerId, t.projectId],
      foreignColumns: [projects.ownerId, projects.id],
    }).onDelete("cascade"),
  ],
);

/** One assignment = instructions + optional starter + settings (spec §5.1).
 *  status: "draft" | "published" | "marks_released" — everything between
 *  (scheduled/open/late_window/closed) is COMPUTED from the timestamps
 *  by computeAssignmentPhase (shared), never stored (design D§6). */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    /** TipTap JSON, validated by InstructionsDocSchema (images are capped data-URIs). */
    instructions: jsonb("instructions").notNull(),
    projectType: text("project_type").notNull(),
    /** null points = complete / not-complete marking (spec §5.1). */
    points: bigint("points", { mode: "number" }),
    submissionMode: text("submission_mode").notNull().default("individual"),
    individualWork: boolean("individual_work").notNull().default(false),
    /** Workspace rules jsonb (WorkspaceRulesSchema) — frozen per assignment (spec §5.4). */
    rules: jsonb("rules").notNull(),
    /** A frozen COPY of the teacher's starter manifest — never an FK to a live project (D§6). */
    starterManifest: jsonb("starter_manifest"),
    status: text("status").notNull().default("draft"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lateUntil: timestamp("late_until", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    marksReleasedAt: timestamp("marks_released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assignments_class_idx").on(t.classId)],
);

/** The student(or group)↔assignment↔project link (design D§2) — the server
 *  is the authority; the manifest is never tagged. */
export const assignmentWork = pgTable(
  "assignment_work",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Exactly one of userId / groupId is set (individual vs pair/group). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    ownerId: uuid("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assignment_work_assignment_user_uq").on(t.assignmentId, t.userId),
    unique("assignment_work_assignment_group_uq").on(t.assignmentId, t.groupId),
    index("assignment_work_project_idx").on(t.ownerId, t.projectId),
    foreignKey({
      columns: [t.ownerId, t.projectId],
      foreignColumns: [projects.ownerId, projects.id],
    }).onDelete("cascade"),
  ],
);

/** Frozen, fingerprinted snapshots (spec §6.4). One row per attempt;
 *  resubmission replaces the head (isCurrent) and keeps the history. */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Individual: the student. Pair/group: null, groupId set instead. */
    submitterId: uuid("submitter_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    /** Who pressed Submit (a group member; equals submitterId when individual). */
    submittedBy: uuid("submitted_by").notNull(),
    /** User ids credited on the receipt — every member for groups (spec §5.5). */
    creditedIds: jsonb("credited_ids").notNull(),
    manifest: jsonb("manifest").notNull(),
    /** sha256 of the stable-stringified manifest — the dispute authority (D§11.6). */
    fingerprint: text("fingerprint").notNull(),
    late: boolean("late").notNull().default(false),
    isCurrent: boolean("is_current").notNull().default(true),
    attempt: bigint("attempt", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("submissions_assignment_idx").on(t.assignmentId),
    index("submissions_assignment_submitter_idx").on(t.assignmentId, t.submitterId),
  ],
);

/** One mark per (assignment, student) — spec §7.3. status: "draft" | "released".
 *  TA drafts await teacher release BY CONSTRUCTION: release is teacher-only. */
export const marks = pgTable(
  "marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    points: bigint("points", { mode: "number" }),
    /** Group work only (spec §5.5, Task 23): how far this member's own mark
     *  sits from the group's. `points` is always the member's FINAL total —
     *  the group's own figure is `points - adjustment`, which is what lets
     *  the marking panel prefill both halves honestly on a second visit.
     *  Always 0 for individual work. */
    adjustment: bigint("adjustment", { mode: "number" }).notNull().default(0),
    comment: text("comment").notNull().default(""),
    privateNote: text("private_note").notNull().default(""),
    status: text("status").notNull().default("draft"),
    returned: boolean("returned").notNull().default(false),
    markedBy: uuid("marked_by").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    /** The submission the draft was written against — a newer attempt flags
     *  the draft stale instead of silently deleting it (design D§11.3). */
    basedOnSubmissionId: uuid("based_on_submission_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("marks_assignment_student_uq").on(t.assignmentId, t.studentId)],
);

/** Pair/group composition per assignment plus the editing baton — a polled
 *  lease (holder + expiry), no live connections (stack §sync, spec §5.5). */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** The shared group project (owned by the founding member's account). */
    ownerId: uuid("owner_id"),
    projectId: text("project_id"),
    batonHolderId: uuid("baton_holder_id"),
    batonExpiresAt: timestamp("baton_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groups_assignment_idx").on(t.assignmentId)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("group_members_group_user_uq").on(t.groupId, t.userId)],
);

/** A teacher's saved custom rule combinations (spec §5.4 "Custom…"). */
export const ruleSets = pgTable(
  "rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rules: jsonb("rules").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("rule_sets_owner_name_uq").on(t.ownerId, t.name)],
);

/** Standalone guide pages — same rich format as instructions (spec §4). */
export const guides = pgTable(
  "guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: jsonb("body").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("guides_class_idx").on(t.classId)],
);

/** Plan 7 (spec §8.1/§8.3, design D§4): DELIVERY state for peer shares —
 *  pending until the recipient accepts ("Add to my projects").
 *  THE LEDGER IS NOT THIS TABLE: every share action writes its own
 *  `events` row in the same transaction, and the event payload's
 *  denormalised ids are the permanent record (D§3). No user or project
 *  column here carries an FK — erasing a person or deleting the source
 *  project must neither delete nor block on delivery rows (the posture
 *  events.actorId and groups.ownerId/projectId already take).
 *  status: "pending" | "accepted" | "revoked" | "lapsed". */
export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sharerId: uuid("sharer_id").notNull(),
    recipientId: uuid("recipient_id").notNull(),
    /** Owner and sharer are the ancestor spec's SEPARATE fields (§17.1);
     *  in Plan 7 they are always equal (you share your own project) and
     *  both are recorded so a re-share chain stays legible in the ledger. */
    sourceOwnerId: uuid("source_owner_id").notNull(),
    sourceProjectId: text("source_project_id").notNull(),
    /** Frozen at share time from the sharer's SERVER head (design D§2) —
     *  accept still works if the source is later deleted or rewritten.
     *  Always ≤ MAX_MANIFEST_BYTES because it was a stored head. */
    frozenManifest: jsonb("frozen_manifest").notNull(),
    /** The ancestor spec's "version identifier" (spec §17.1). */
    sourceClientUpdatedAt: bigint("source_client_updated_at", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    /** Set at accept — the recipient's fresh copy id (D§4). */
    copyProjectId: text("copy_project_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("shares_recipient_status_idx").on(t.recipientId, t.status),
    index("shares_class_status_idx").on(t.classId, t.status),
    /** RACE BACKSTOP behind the route's friendly read-then-409 duplicate
     *  check: two concurrent identical POSTs can both pass the read, so
     *  this partial unique index is what makes the second insert fail
     *  instead of minting a second pending row for the same
     *  (sourceOwnerId, sourceProjectId, recipientId) triple. Partial on
     *  status = 'pending' so a resolved share (accepted/revoked/lapsed)
     *  never blocks a fresh share of the same triple. */
    uniqueIndex("shares_pending_dedup_idx")
      .on(t.sourceOwnerId, t.sourceProjectId, t.recipientId)
      .where(sql`"status" = 'pending'`),
  ],
);

/** Plan 8 (spec §9, design D§2): DELIVERY for the in-app bell — one row per
 *  recipient, fanned out AT WRITE TIME in the same transaction as the event,
 *  because the events ledger records who ACTED and never who should be told
 *  (three bell-relevant event types store no recoverable audience at all).
 *  THE LEDGER IS NOT THIS TABLE: `events` stays append-only, unindexed and
 *  audience-free — the bell reads here, never there. user_id cascades on a
 *  real user delete; under the D§5 erasure scrub the rows are deleted
 *  explicitly (delivery state, not history). */
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => events.id),
    /** Denormalised so the bell renders without joining events. */
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.id.desc()),
    index("notifications_user_unread_idx")
      .on(t.userId, t.id.desc())
      .where(sql`"read_at" IS NULL`),
  ],
);

/** Plan 8 (spec §9, design D§4): the five email switches. Keys are the email
 *  TEMPLATE strings verbatim (submission-receipt, marks-released,
 *  work-returned, due-tomorrow, due-reminder) — an absent row means the
 *  default, ON, so adding a key never needs a backfill. These gate EMAIL
 *  only; the bell is never preference-gated (D§4). */
export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
