/** All templates return plain text — spec §9: short, plain, about one thing. */

/** The five switchable templates (shared's SWITCHABLE_EMAIL_KEYS) close with
 *  this line. It lives HERE, not in a driver, because spec §9 promises the
 *  dev pretend inbox shows every email "exactly as it would look" — a
 *  footer the real postman appended and the preview did not would make that
 *  promise false and bake the divergence into a test. None of the five
 *  carries a token URL (confirm/reset/invite do, and are not switchable), so
 *  the suites that regex a live `token=` out of a stored body are untouched. */
export const SWITCH_OFF_FOOTER = "You can switch these emails off on your profile page.";

/* ══════════════════════════════════════════════════════════════════
   The designed HTML layer (2026-09-02, user-ordered): every template
   ships an html body beside its text. The TEXT body is the contract —
   byte-pinned by templates.test.ts, stored (redacted) in the log,
   rendered by the pretend inbox; the html rides the wire only. Email
   HTML is 2005 CSS: tables, inline styles, no external images — the
   "logo" is a styled wordmark, which no client can block.
   ══════════════════════════════════════════════════════════════════ */

/** Contact shown in every footer (user-supplied, 2026-09-02). */
export const MAIL_CONTACT = "tsewpau@uwc.ac.za";
export const MAIL_ORG_LINE = "Physics IDE · Physical Sciences · University of the Western Cape";

const ACCENT = "#0973d1";

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A paragraph of body text. */
function para(text: string): string {
  return `<p style="margin:0 0 14px 0; font-size:15px; line-height:1.55; color:#24292f;">${escHtml(text)}</p>`;
}

/** A bold single-line fact, label + value. */
function fact(label: string, value: string): string {
  return `<p style="margin:0 0 6px 0; font-size:14px; color:#24292f;"><span style="color:#57606a;">${escHtml(label)}:</span> <strong>${escHtml(value)}</strong></p>`;
}

/** The one call-to-action button; the raw link is repeated beneath it for
 *  clients that strip buttons — the recipient always has a working URL. */
function btn(url: string, label: string): string {
  const u = escHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:8px; background:${ACCENT};"><a href="${u}" style="display:inline-block; padding:11px 22px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${escHtml(label)}</a></td></tr></table><p style="margin:0 0 14px 0; font-size:12px; line-height:1.5; color:#57606a; word-break:break-all;">Or open this link: ${u}</p>`;
}

/** The shared frame: wordmark header, white card, footer with the org
 *  line and contact — plus the switch-off line on the five switchable
 *  templates (same sentence as the text body's SWITCH_OFF_FOOTER). */
function wrapHtml(contentHtml: string, opts: { switchable?: boolean } = {}): string {
  const switchLine = opts.switchable
    ? `<p style="margin:8px 0 0 0; font-size:12px; color:#57606a;">${escHtml(SWITCH_OFF_FOOTER)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0; padding:0; background:#f5f6f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8; padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">
<tr><td style="padding:0 4px 14px 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="font-size:19px; font-weight:700; color:#24292f; letter-spacing:-0.2px;">Physics<span style="color:${ACCENT};">IDE</span></span>
</td></tr>
<tr><td style="background:#ffffff; border:1px solid #e4e7eb; border-radius:10px; padding:26px 28px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${contentHtml}
</td></tr>
<tr><td style="padding:16px 4px 0 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <p style="margin:0; font-size:12px; color:#57606a;">${escHtml(MAIL_ORG_LINE)}</p>
  <p style="margin:4px 0 0 0; font-size:12px; color:#57606a;">Questions? <a href="mailto:${MAIL_CONTACT}" style="color:${ACCENT}; text-decoration:none;">${MAIL_CONTACT}</a></p>
  ${switchLine}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function confirmEmail(p: { name: string; confirmUrl: string }) {
  return {
    subject: "Confirm your address — Physics IDE",
    text: `Hi ${p.name},

Welcome to Physics IDE. Please confirm your email address by opening this link:

${p.confirmUrl}

The link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
    html: wrapHtml(
      para(`Hi ${p.name},`) +
        para("Welcome to Physics IDE. Please confirm your email address:") +
        btn(p.confirmUrl, "Confirm my address") +
        para("The link expires in 48 hours. If you didn't sign up, you can ignore this email."),
    ),
  };
}

export function resetEmail(p: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your password — Physics IDE",
    text: `Hi ${p.name},

Someone asked to reset the password for this account. If that was you, open this link:

${p.resetUrl}

The link expires in 60 minutes and works once. If you didn't ask, ignore this email — nothing changes.`,
    html: wrapHtml(
      para(`Hi ${p.name},`) +
        para("Someone asked to reset the password for this account. If that was you:") +
        btn(p.resetUrl, "Reset my password") +
        para("The link expires in 60 minutes and works once. If you didn't ask, ignore this email — nothing changes."),
    ),
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
    html: wrapHtml(
      para("A new teacher account was just created.") +
        fact("Name", p.name) +
        fact("Email", p.email) +
        fact("Time", p.time) +
        btn(p.consoleUrl, "Review in the admin console"),
    ),
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
    html: wrapHtml(
      para("Hi,") +
        para(roleLine) +
        fact("Class", className) +
        btn(p.joinUrl, "Join the class") +
        para("If you don't have an account yet, the link will walk you through signing up first."),
    ),
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
    html: wrapHtml(
      para("Hi,") +
        para(`Your submission for "${title}" (${className}) was received.`) +
        fact("Submitted", p.submittedAt) +
        fact("Attempt", String(p.attempt)) +
        fact("Fingerprint", p.fingerprint) +
        (p.credited?.length ? fact("Credited", p.credited.join(", ")) : "") +
        para("Keep this fingerprint — it's the record of exactly what was submitted, and the answer if there's ever a dispute about what was turned in."),
      { switchable: true },
    ),
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
    html: wrapHtml(
      para(`Hi ${p.name},`) +
        para(`Your teacher noticed you haven't submitted "${title}" (${className}) yet.${dueLine}`) +
        para("Log in to Physics IDE and submit when you're ready."),
      { switchable: true },
    ),
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
    html: wrapHtml(
      para(`Hi ${p.name},`) +
        para(`"${title}" (${className}) is due soon and you haven't submitted yet.${dueLine}`) +
        para("Log in to Physics IDE and submit when you're ready."),
      { switchable: true },
    ),
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
    // Fiat 12 holds in HTML too: a notification, never the mark itself.
    html: wrapHtml(
      para("Hi,") +
        para(`Your marks for "${title}" (${className}) are ready.`) +
        para("Sign in to Physics IDE to see them."),
      { switchable: true },
    ),
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
    html: wrapHtml(
      para("Hi,") +
        para(`Your teacher has sent "${title}" (${className}) back for changes.`) +
        `<blockquote style="margin:0 0 14px 0; padding:10px 14px; border-left:3px solid ${ACCENT}; background:#f5f8fc; border-radius:0 6px 6px 0; font-size:15px; line-height:1.55; color:#24292f;">${escHtml(p.comment)}</blockquote>` +
        para("You can resubmit when you're ready."),
      { switchable: true },
    ),
  };
}
