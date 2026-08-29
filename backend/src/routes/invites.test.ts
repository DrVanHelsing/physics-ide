import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, invites, emails, notifications, events } from "../db/schema.js";

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

// Each signin gets its own source IP — the auth route's per-IP rate limit is
// sized for humans and this file signs in several accounts.
let signinIpCounter = 0;
async function signin(email: string): Promise<string> {
  signinIpCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.96.${Math.floor(signinIpCounter / 250)}.${(signinIpCounter % 250) + 1}`,
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function notificationsFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
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

  test("inviting a WAITING member sends (not skips); accepting upgrades them to active with the invited role", async () => {
    const waiter = await makeUser("waiter@example.com");
    await testDb.insert(classMembers).values({
      classId,
      userId: waiter.id,
      role: "student",
      status: "waiting",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["waiter@example.com"], role: "ta" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toEqual(["waiter@example.com"]);
    expect(res.json().skipped).toEqual([]);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "waiter@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    const waiterCookie = await signin("waiter@example.com");
    const accept = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: waiterCookie },
      payload: { token },
    });
    expect(accept.statusCode).toBe(200);

    const [row] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, waiter.id)));
    expect(row.status).toBe("active");
    expect(row.role).toBe("ta");
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

  test("resend into an archived class is refused", async () => {
    const archived = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Archive Resend Class" },
    });
    const archivedClassId = archived.json().class.id as string;
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClassId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["archivedinvitee@example.com"], role: "student" },
    });
    const [inv] = await testDb
      .select()
      .from(invites)
      .where(
        and(eq(invites.classId, archivedClassId), eq(invites.email, "archivedinvitee@example.com")),
      );
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClassId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/invites/${inv.id}/resend`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });

  test("accepting an invite into an archived class is refused; the invite stays pending", async () => {
    const archived = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Archive Accept Class" },
    });
    const archivedClassId = archived.json().class.id as string;
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClassId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["archivedaccepter@example.com"], role: "student" },
    });
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "archivedaccepter@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    await makeUser("archivedaccepter@example.com");
    const accepterCookie = await signin("archivedaccepter@example.com");

    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClassId}/archive`,
      cookies: { pide_session: teacherCookie },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: accepterCookie },
      payload: { token },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");

    const [inv] = await testDb
      .select()
      .from(invites)
      .where(
        and(eq(invites.classId, archivedClassId), eq(invites.email, "archivedaccepter@example.com")),
      );
    expect(inv.status).toBe("pending");
  });

  test("an already-active member who accepts an invite gets the invited role applied", async () => {
    // Fresh (open-join) class so the direct join below lands active immediately —
    // the shared `classId` above is already in approval mode by this point in the file.
    const promoClassRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Promotion Class" },
    });
    const promoClassId = promoClassRes.json().class.id as string;
    const promoJoinCode = promoClassRes.json().class.joinCode as string;

    // The invitee joins by code directly first, landing active as a student —
    // independent of (and before accepting) the co-teacher invite already in flight.
    const promoted = await makeUser("mpromoted@example.com");
    const promotedCookie = await signin("mpromoted@example.com");
    const inviteRes = await app.inject({
      method: "POST",
      url: `/api/classes/${promoClassId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["mpromoted@example.com"], role: "teacher" },
    });
    expect(inviteRes.statusCode).toBe(200);
    expect(inviteRes.json().sent).toEqual(["mpromoted@example.com"]);
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "mpromoted@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const joinRes = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: promotedCookie },
      payload: { code: promoJoinCode },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().status).toBe("active");

    const acceptRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: promotedCookie },
      payload: { token },
    });
    expect(acceptRes.statusCode).toBe(200);

    const [row] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, promoClassId), eq(classMembers.userId, promoted.id)));
    expect(row.status).toBe("active");
    expect(row.role).toBe("teacher");
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

/* Task 5, site 9: invite.accepted fans out to the class's active teachers —
 * the quiet joined event's second door (an invited member lands ACTIVE
 * without passing the join route). A fresh class isolates the recipient set
 * from the rest of this file's shared `classId`, which is in approval mode
 * by this point and carries other teachers' worth of history. */
describe("notification fan-out for invite.accepted (Task 5, site 9)", () => {
  test("accepting a fresh invite notifies the class's active teachers, addressed to the accepting user — never the accepter themselves", async () => {
    const notifyClassRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Notify Invite Class" },
    });
    const notifyClassId = notifyClassRes.json().class.id as string;

    const inviteRes = await app.inject({
      method: "POST",
      url: `/api/classes/${notifyClassId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["inaccept-notify@example.com"], role: "student" },
    });
    expect(inviteRes.statusCode).toBe(200);
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "inaccept-notify@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const accepter = await makeUser("inaccept-notify@example.com");
    const accepterCookie = await signin("inaccept-notify@example.com");

    const acceptRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: accepterCookie },
      payload: { token },
    });
    expect(acceptRes.statusCode).toBe(200);

    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "iteach@example.com"));
    const teacherNotifs = await notificationsFor(teacherRow.id);
    // Scoped to THIS class — iteach teaches every class this file creates, so
    // earlier accept tests (classId, promoClassId) have already addressed
    // iteach with their own invite.accepted rows.
    const matching = teacherNotifs.filter(
      (n) => n.type === "invite.accepted" && (n.payload as { classId?: string }).classId === notifyClassId,
    );
    expect(matching).toHaveLength(1);
    expect(matching[0].payload).toEqual({ classId: notifyClassId, joinerId: accepter.id });

    const [ev] = await testDb.select().from(events).where(eq(events.id, matching[0].eventId));
    expect(ev.type).toBe("invite.accepted");
    expect(ev.actorId).toBe(accepter.id);

    // Negative: the accepting user is not notified about their own acceptance.
    expect(await notificationsFor(accepter.id)).toHaveLength(0);
  });
});
