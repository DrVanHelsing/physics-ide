import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";
import { emails } from "../db/schema.js";
import { createDevMailer } from "./mailer.js";
import { confirmEmail, resetEmail, teacherSignupAlert, classInvite } from "./templates.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "emails"');
});

afterAll(async () => {
  await pool.end();
});

describe("dev mailer", () => {
  test("send() writes a row into the emails table", async () => {
    const mailer = createDevMailer(db);
    await mailer.send({
      to: "kid@example.com",
      template: "confirm",
      subject: "Confirm your address — Physics IDE",
      text: "hello",
    });
    const rows = await db.select().from(emails);
    expect(rows).toHaveLength(1);
    expect(rows[0].toEmail).toBe("kid@example.com");
    expect(rows[0].template).toBe("confirm");
    expect(rows[0].status).toBe("dev");
  });
});

describe("templates", () => {
  test("confirm email contains the link and names the 48h expiry", () => {
    const m = confirmEmail({ name: "Za", confirmUrl: "http://x/auth/confirm?token=abc" });
    expect(m.subject).toBe("Confirm your address — Physics IDE");
    expect(m.text).toContain("http://x/auth/confirm?token=abc");
    expect(m.text).toContain("48 hours");
  });

  test("reset email contains the link and names the 60 minute expiry", () => {
    const m = resetEmail({ name: "Za", resetUrl: "http://x/auth/reset?token=abc" });
    expect(m.subject).toBe("Reset your password — Physics IDE");
    expect(m.text).toContain("http://x/auth/reset?token=abc");
    expect(m.text).toContain("60 minutes");
  });

  test("teacher alert carries name, email, time and console link (spec §3.1)", () => {
    const m = teacherSignupAlert({
      name: "New Teacher",
      email: "t@example.com",
      time: "2026-08-18 18:00",
      consoleUrl: "http://x/admin",
    });
    expect(m.subject).toBe("A new teacher signed up — Physics IDE");
    for (const needle of ["New Teacher", "t@example.com", "2026-08-18 18:00", "http://x/admin"]) {
      expect(m.text).toContain(needle);
    }
  });

  test("class invite sanitizes CRLF in a teacher-supplied class name to a single-line subject", () => {
    const m = classInvite({
      className: "Physics 101\r\nX-Injected: 1",
      inviterName: "Ms. Chen",
      joinUrl: "http://x/join/invite?token=abc",
      role: "student",
    });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject).toBe("You're invited to Physics 101 X-Injected: 1 — Physics IDE");
    expect(m.text).toContain("Class: Physics 101 X-Injected: 1");
  });
});
