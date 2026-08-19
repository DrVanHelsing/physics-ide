/** All templates return plain text — spec §9: short, plain, about one thing. */

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
  const subject =
    p.role === "ta"
      ? `You're invited to assist ${p.className} — Physics IDE`
      : `You're invited to ${p.className} — Physics IDE`;
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

Class: ${p.className}

Join here: ${p.joinUrl}

If you don't have an account yet, the link will walk you through signing up first.`,
  };
}
