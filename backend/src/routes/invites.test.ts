import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, invites, emails } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let inviteeCookie: string;
let outsiderCookie: string;
let classId: string;

async function makeUser(email: string, opts: Record<string, unknown> = {}) {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...opts,
    })
    .returning();
  return u;
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("iteach@example.com", { isTeacher: true });
  await makeUser("invitee@example.com");
  await makeUser("outsider@example.com");
  teacherCookie = await signin("iteach@example.com");
  inviteeCookie = await signin("invitee@example.com");
  outsiderCookie = await signin("outsider@example.com");
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Invite Class" },
  });
  classId = res.json().class.id;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("sending invites", () => {
  test("teacher invites a student and a TA: rows + emails with join links; TA subject differs", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["invitee@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toEqual(["invitee@example.com"]);

    const ta = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["helper@example.com"], role: "ta" },
    });
    expect(ta.statusCode).toBe(200);

    const mails = await testDb.select().from(emails).where(eq(emails.template, "class-invite"));
    expect(mails).toHaveLength(2);
    const subjects = mails.map((m) => m.subject);
    expect(subjects).toContain("You're invited to Invite Class — Physics IDE");
    expect(subjects).toContain("You're invited to assist Invite Class — Physics IDE");
    for (const m of mails) expect(m.bodyText).toContain("/join/invite?token=");
  });

  test("non-teacher may not invite", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: outsiderCookie },
      payload: { emails: ["x@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(403);
  });

  test("inviting an existing active member reports it as skipped", async () => {
    await testDb.insert(classMembers).values({
      classId,
      userId: (await testDb.select().from(users).where(eq(users.email, "outsider@example.com")))[0]
        .id,
      role: "student",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["outsider@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().skipped).toEqual(["outsider@example.com"]);
    expect(res.json().sent).toEqual([]);
  });
});

describe("accepting and revoking", () => {
  test("accepting a pending invite adds an ACTIVE membership even in approval mode", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "invitee@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    const res = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, classId, status: "active" });

    const again = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe("That invite link is no longer valid.");
  });

  test("revoked invites cannot be accepted", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["revokeme@example.com"], role: "student" },
    });
    const [inv] = await testDb
      .select()
      .from(invites)
      .where(and(eq(invites.classId, classId), eq(invites.email, "revokeme@example.com")));
    const rev = await app.inject({
      method: "POST",
      url: `/api/invites/${inv.id}/revoke`,
      cookies: { pide_session: teacherCookie },
    });
    expect(rev.statusCode).toBe(200);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "revokeme@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    const res = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(res.statusCode).toBe(400);
  });

  test("resend rotates the link: a second email goes out, the old link dies, the new one works", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["resendme@example.com"], role: "student" },
    });
    const [inv] = await testDb
      .select()
      .from(invites)
      .where(and(eq(invites.classId, classId), eq(invites.email, "resendme@example.com")));
    const mailsBefore = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "resendme@example.com"));
    const oldToken = /token=([A-Za-z0-9_-]+)/.exec(mailsBefore[0].bodyText)![1];

    const res = await app.inject({
      method: "POST",
      url: `/api/invites/${inv.id}/resend`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const mailsAfter = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "resendme@example.com"));
    expect(mailsAfter).toHaveLength(2);
    const freshToken = /token=([A-Za-z0-9_-]+)/.exec(mailsAfter[1].bodyText)![1];

    const oldRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token: oldToken },
    });
    expect(oldRes.statusCode).toBe(400);
    const newRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token: freshToken },
    });
    expect(newRes.statusCode).toBe(200);
  });

  test("teacher lists pending invites", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().invites as Array<{ email: string; status: string }>;
    expect(list.every((i) => i.status === "pending")).toBe(true);
  });
});
