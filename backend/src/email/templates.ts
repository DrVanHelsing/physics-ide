/** All templates return plain text — spec §9: short, plain, about one thing. */

/** The five switchable templates (shared's SWITCHABLE_EMAIL_KEYS) close with
 *  this line. It lives HERE, not in a driver, because spec §9 promises the
 *  dev pretend inbox shows every email "exactly as it would look" — a
 *  footer the real postman appended and the preview did not would make that
 *  promise false and bake the divergence into a test. None of the five
 *  carries a token URL (confirm/reset/invite do, and are not switchable), so
 *  the suites that regex a live `token=` out of a stored body are untouched. */
export const SWITCH_OFF_FOOTER = "You can switch these emails off on your profile page.";

export function confirmEmail(p: { name: string; confirmUrl: string }) {
  return {
    subject: "Confirm your address — Physics IDE",
    text: `Hi ${p.name},

Welcome to Physics IDE. Please confirm your email address by opening this link:

${p.confirmUrl}

The link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
  };
}

export function resetEmail(p: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your password — Physics IDE",
    text: `Hi ${p.name},

Someone asked to reset the password for this account. If that was you, open this link:

${p.resetUrl}

The link expires in 60 minutes and works once. If you didn't ask, ignore this email — nothing changes.`,
  };
}

export function teacherSignupAlert(p: {
  name: string;
  email: string;
  time: string;
  consoleUrl: string;
}) {
  return {
    subject: "A new teacher signed up — Physics IDE",
    text: `A new teacher account was just created.

Name:  ${p.name}
Email: ${p.email}
Time:  ${p.time}

Review it in the admin console: ${p.consoleUrl}`,
  };
}

export function classInvite(p: {
  className: string;
  inviterName: string;
  joinUrl: string;
  role: "student" | "ta" | "teacher";
}) {
  // Class names are teacher-supplied free text; a CRLF inside one could inject a
  // fake header into an email client that parses raw headers from the subject line.
  const className = p.className.replace(/[\r\n]+/g, " ");
  const subject =
    p.role === "ta"
      ? `You're invited to assist ${className} — Physics IDE`
      : `You're invited to ${className} — Physics IDE`;
  const roleLine =
    p.role === "student"
      ? `${p.inviterName} has invited you to join their class.`
      : p.role === "ta"
        ? `${p.inviterName} has invited you to be a teaching assistant.`
        : `${p.inviterName} has invited you to co-teach their class.`;
  return {
    subject,
    text: `Hi,

${roleLine}

Class: ${className}

Join here: ${p.joinUrl}

If you don't have an account yet, the link will walk you through signing up first.`,
  };
}

/** The submission receipt — spec §6.4/design D§11.6: the fingerprint here
 *  IS the dispute authority, so it always renders in full (never truncated,
 *  the way the UI's own success alert shortens it for display). */
export function submissionReceipt(p: {
  title: string;
  className: string;
  submittedAt: string;
  attempt: number;
  fingerprint: string;
  /** Group work (spec §5.5): every member's name, since any member may have
   *  pressed Submit and the others are entitled to know what was handed in
   *  for them, and with whom. Null/absent for individual work. */
  credited?: string[] | null;
}) {
  // Same CRLF-strip as classInvite — title/className are teacher- or
  // student-supplied free text, never trusted to sit unescaped in a subject.
  const title = p.title.replace(/[\r\n]+/g, " ");
  const className = p.className.replace(/[\r\n]+/g, " ");
  const creditedLine = p.credited?.length ? `\nCredited: ${p.credited.join(", ")}` : "";
  return {
    subject: `Submission received — ${title}`,
    text: `Hi,

Your submission for "${title}" (${className}) was received.

Submitted: ${p.submittedAt}
Attempt:   ${p.attempt}
Fingerprint: ${p.fingerprint}${creditedLine}

Keep this fingerprint — it's the record of exactly what was submitted, and the answer if there's ever a dispute about what was turned in.

${SWITCH_OFF_FOOTER}`,
  };
}

/* ── Task 16: inbox ── */
/** The teacher's one-click nudge — POST /remind sends this to every student
 *  the inbox flags "missing", one email each. Same CRLF-strip as
 *  classInvite/submissionReceipt (title/className are teacher-supplied
 *  free text). */
export function dueReminder(p: {
  name: string;
  title: string;
  className: string;
  dueAt: string | null;
}) {
  const title = p.title.replace(/[\r\n]+/g, " ");
  const className = p.className.replace(/[\r\n]+/g, " ");
  const dueLine = p.dueAt ? ` It was due ${p.dueAt}.` : "";
  return {
    subject: `Reminder — ${title} is still waiting on you`,
    text: `Hi ${p.name},

Your teacher noticed you haven't submitted "${title}" (${className}) yet.${dueLine}

Log in to Physics IDE and submit when you're ready.

${SWITCH_OFF_FOOTER}`,
  };
}

/* ── Task 24: the daily tick ── */
/** The one scheduled email (design D§6's one scheduler) — a student with no
 *  current submission, one day out from the due date. Same CRLF-strip and
 *  shape as dueReminder (the teacher's own one-click nudge); this is the
 *  system's, sent once per (assignment, student) via the events-table dedupe
 *  in tick.ts, never re-sent by a later tick. */
export function dueTomorrow(p: {
  name: string;
  title: string;
  className: string;
  dueAt: string | null;
}) {
  const title = p.title.replace(/[\r\n]+/g, " ");
  const className = p.className.replace(/[\r\n]+/g, " ");
  const dueLine = p.dueAt ? ` It's due ${p.dueAt}.` : "";
  return {
    subject: `Due tomorrow — ${title}`,
    text: `Hi ${p.name},

"${title}" (${className}) is due soon and you haven't submitted yet.${dueLine}

Log in to Physics IDE and submit when you're ready.

${SWITCH_OFF_FOOTER}`,
  };
}

/* ── Task 18: marks ── */
/** Released feedback (spec §7.3) — a NOTIFICATION, not a copy of the mark.
 *  It carries neither the score nor the teacher's comment (design D§10 fiat
 *  12's data-minimisation condition): behind a real postman this template
 *  exported a school-aged user's mark and their teacher's words verbatim to
 *  a sub-processor outside the country, and the delivery log then kept both
 *  in `body_text` — which the `token=` redaction does not touch. Score and
 *  comment stay fully visible where they belong: the marking screen, the
 *  bell, and the data export.
 *
 *  The signature is narrowed to match. points/outOf/comment are not merely
 *  unused here, they are no longer accepted, so no later edit can quietly
 *  reintroduce them. privateNote never reached this template either. */
export function marksReleased(p: { title: string; className: string }) {
  const title = p.title.replace(/[\r\n]+/g, " ");
  const className = p.className.replace(/[\r\n]+/g, " ");
  return {
    subject: `Feedback released — ${title}`,
    text: `Hi,

Your marks for "${title}" (${className}) are ready.

Sign in to Physics IDE to see them.

${SWITCH_OFF_FOOTER}`,
  };
}

/** Return for changes (design D§11.2) — the comment IS the reason, so it
 *  always renders in full. The honest "you can resubmit" line matches
 *  AssignmentPage.js's own returned-state alert copy. */
export function workReturned(p: { title: string; className: string; comment: string }) {
  const title = p.title.replace(/[\r\n]+/g, " ");
  const className = p.className.replace(/[\r\n]+/g, " ");
  return {
    subject: `Changes requested — ${title}`,
    text: `Hi,

Your teacher has sent "${title}" (${className}) back for changes.

${p.comment}

You can resubmit when you're ready.

${SWITCH_OFF_FOOTER}`,
  };
}
