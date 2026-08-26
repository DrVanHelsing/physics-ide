import { pgTable, text, jsonb, bigserial, uuid, timestamp, boolean, unique, bigint, primaryKey, index, foreignKey } from "drizzle-orm/pg-core";

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
