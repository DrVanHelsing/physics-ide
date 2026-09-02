import { describe, test, expect } from "vitest";
import { SWITCHABLE_EMAIL_KEYS } from "@physics-ide/shared";
import {
  SWITCH_OFF_FOOTER,
  confirmEmail,
  resetEmail,
  teacherSignupAlert,
  classInvite,
  submissionReceipt,
  dueReminder,
  dueTomorrow,
  marksReleased,
  workReturned,
} from "./templates.js";

/** The five switchable keys, mapped to the template each one names. Keyed
 *  off shared's SWITCHABLE_EMAIL_KEYS rather than a hand-written list, so a
 *  sixth switchable row cannot be added without this file failing to
 *  compile — the footer promise is made per key, not per function. */
const SWITCHABLE: Record<(typeof SWITCHABLE_EMAIL_KEYS)[number], { subject: string; text: string }> =
  {
    "submission-receipt": submissionReceipt({
      title: "Ramp",
      className: "P1",
      submittedAt: "now",
      attempt: 1,
      fingerprint: "abc",
    }),
    "marks-released": marksReleased({ title: "Ramp", className: "P1" }),
    "work-returned": workReturned({ title: "Ramp", className: "P1", comment: "Redo section 2." }),
    "due-tomorrow": dueTomorrow({ name: "Kid", title: "Ramp", className: "P1", dueAt: "tomorrow" }),
    "due-reminder": dueReminder({ name: "Kid", title: "Ramp", className: "P1", dueAt: "friday" }),
  };

const NON_SWITCHABLE = {
  confirm: confirmEmail({ name: "Kid", confirmUrl: "http://x/confirm?token=live_TOKEN-1" }),
  reset: resetEmail({ name: "Kid", resetUrl: "http://x/reset?token=live_TOKEN-2" }),
  "teacher-alert": teacherSignupAlert({
    name: "Teach",
    email: "t@example.com",
    time: "now",
    consoleUrl: "http://x/admin",
  }),
  "class-invite": classInvite({
    className: "P1",
    inviterName: "Teach",
    joinUrl: "http://x/join?token=live_TOKEN-3",
    role: "student",
  }),
};

describe("the switch-off footer", () => {
  test.each(SWITCHABLE_EMAIL_KEYS)("%s ends with the footer line", (key) => {
    expect(SWITCHABLE[key].text).toContain(SWITCH_OFF_FOOTER);
    // Last thing in the body, not buried mid-message.
    expect(SWITCHABLE[key].text.trimEnd().endsWith(SWITCH_OFF_FOOTER)).toBe(true);
  });

  test("the footer is the promised sentence, verbatim", () => {
    expect(SWITCH_OFF_FOOTER).toBe("You can switch these emails off on your profile page.");
  });

  test("the four ALWAYS-ON templates do NOT carry it — there is nothing to switch off", () => {
    for (const [key, mail] of Object.entries(NON_SWITCHABLE)) {
      expect(mail.text, key).not.toContain(SWITCH_OFF_FOOTER);
    }
  });

  /** The footer lives in templates.ts, not the driver, so BOTH drivers emit
   *  it — spec §9 promises the dev pretend inbox shows every email "exactly
   *  as it would look". A driver-side footer would make the preview diverge
   *  from what the provider actually sends and bake that lie into a test.
   *  This is safe for the redaction constraint only because no switchable
   *  template carries a token URL; that is asserted rather than assumed. */
  test("no switchable template carries a token= URL, so redaction never collides with the footer", () => {
    for (const key of SWITCHABLE_EMAIL_KEYS) {
      expect(SWITCHABLE[key].text, key).not.toMatch(/token=/);
    }
    // Control: the templates that DO carry one are exactly the always-on
    // three, whose bodies the ~20 live-token assertions read out of the dev
    // inbox. If this ever flips, the redaction blast radius has changed.
    expect(NON_SWITCHABLE.confirm.text).toMatch(/token=/);
    expect(NON_SWITCHABLE.reset.text).toMatch(/token=/);
    expect(NON_SWITCHABLE["class-invite"].text).toMatch(/token=/);
  });
});

/** D§10 fiat 12's data-minimisation condition. The old body interpolated a
 *  score line and the teacher's comment verbatim; behind a real postman
 *  that exported a school-aged user's mark and their teacher's words to a
 *  sub-processor outside the country, and left both sitting in the delivery
 *  log's `body_text`, which the `token=` redaction does not touch. */
describe("marksReleased carries neither the score nor the comment", () => {
  test("the body announces the release and sends them to sign in — nothing more", () => {
    const mail = marksReleased({ title: "Ramp Lab", className: "Physics 1" });
    expect(mail.subject).toBe("Feedback released — Ramp Lab");
    expect(mail.text).toContain('Your marks for "Ramp Lab" (Physics 1) are ready.');
    expect(mail.text).toContain("Sign in to Physics IDE to see them.");
  });

  test("no digits, no slash-score, and no room for a comment to hide in", () => {
    const mail = marksReleased({ title: "Ramp Lab", className: "Physics 1" });
    // The two shapes the old template produced: "Score: 9/10" and the bare
    // "Marked complete." / "Reviewed — no score recorded." lines.
    expect(mail.text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(mail.text).not.toMatch(/Score:/);
    expect(mail.text).not.toMatch(/Marked complete|no score recorded/);
    // The whole body is a fixed sentence pair plus the title, the class and
    // the footer — nothing per-student beyond the assignment it names.
    expect(mail.text.replace('"Ramp Lab" (Physics 1)', "")).not.toMatch(/[0-9]/);
  });

  test("the subject still names the assignment — the inbox has to be scannable", () => {
    // Several suites find the right mail by subject; minimisation is about
    // the mark, not about making the email anonymous.
    expect(marksReleased({ title: "Group Release", className: "P1" }).subject).toContain(
      "Group Release",
    );
  });

  test("CRLF is still stripped from teacher-supplied title and class name", () => {
    const mail = marksReleased({ title: "A\r\nB", className: "C\nD" });
    expect(mail.subject).toBe("Feedback released — A B");
    expect(mail.text).toContain('"A B" (C D)');
  });

  // The signature itself is the guard that outlasts these assertions:
  // marksReleased no longer ACCEPTS points/outOf/comment, so a later edit
  // cannot quietly reintroduce them without a type error. That is enforced
  // by `npm run typecheck -w backend`, not by a runtime expectation.
});

describe("workReturned still carries the comment — minimisation is targeted, not blanket", () => {
  test("the comment IS the reason for the return, so it stays", () => {
    const mail = workReturned({ title: "Ramp", className: "P1", comment: "Redo section 2." });
    expect(mail.text).toContain("Redo section 2.");
  });
});

/* ── The designed HTML layer (2026-09-02, user-ordered) ─────────────────── */
import { MAIL_CONTACT, MAIL_ORG_LINE } from "./templates.js";

describe("every template ships a designed html body beside its text", () => {
  const ALL = {
    confirm: confirmEmail({ name: "Amy", confirmUrl: "https://x.test/auth/confirm?token=T1" }),
    reset: resetEmail({ name: "Amy", resetUrl: "https://x.test/auth/reset?token=T2" }),
    teacherAlert: teacherSignupAlert({ name: "Mr T", email: "t@x.test", time: "now", consoleUrl: "https://x.test/admin" }),
    invite: classInvite({ className: "P1", inviterName: "Mr T", joinUrl: "https://x.test/join/invite?token=T3", role: "student" as const }),
    receipt: submissionReceipt({ title: "Ramp", className: "P1", submittedAt: "now", attempt: 1, fingerprint: "abc" }),
    dueReminder: dueReminder({ name: "Amy", title: "Ramp", className: "P1", dueAt: null }),
    dueTomorrow: dueTomorrow({ name: "Amy", title: "Ramp", className: "P1", dueAt: null }),
    marks: marksReleased({ title: "Ramp", className: "P1" }),
    returned: workReturned({ title: "Ramp", className: "P1", comment: "Redo section 2." }),
  };

  test("html exists everywhere, and every footer carries the org line and the contact", () => {
    for (const [key, mail] of Object.entries(ALL)) {
      expect((mail as { html?: string }).html, key).toBeTruthy();
      const html = (mail as { html: string }).html;
      expect(html, key).toContain(MAIL_ORG_LINE);
      expect(html, key).toContain(MAIL_CONTACT);
      expect(html, key).toContain("Physics<span"); // the wordmark header
    }
  });

  test("the token links survive into html — the recipient's button must work", () => {
    expect(ALL.confirm.html).toContain("token=T1");
    expect(ALL.reset.html).toContain("token=T2");
    expect(ALL.invite.html).toContain("token=T3");
  });

  test("the switch-off sentence appears in html for exactly the five switchable templates", () => {
    for (const key of ["receipt", "dueReminder", "dueTomorrow", "marks", "returned"] as const) {
      expect(ALL[key].html, key).toContain(SWITCH_OFF_FOOTER);
    }
    for (const key of ["confirm", "reset", "teacherAlert", "invite"] as const) {
      expect(ALL[key].html, key).not.toContain(SWITCH_OFF_FOOTER);
    }
  });

  test("user-supplied text is HTML-escaped — a hostile comment cannot inject markup", () => {
    const hostile = workReturned({ title: "Ramp", className: "P1", comment: '<script>alert("x")</script>' });
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).toContain("&lt;script&gt;");
  });

  test("marksReleased html is a notification, not the mark (fiat 12 holds in html too)", () => {
    expect(ALL.marks.html).not.toMatch(/points|score|comment|\d+\s*\/\s*\d+/i);
  });
});
