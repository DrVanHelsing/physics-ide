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
