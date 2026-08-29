import { z } from "zod";

/** Spec §9's five switchable rows, keyed AS THE EMAIL TEMPLATE STRINGS
 *  verbatim (design D§4) — the mailer decorator does a Set-membership test
 *  with no mapping table to rot. The four "Always" rows (confirm, reset,
 *  teacher-alert, class-invite) are ungated by construction. These gate
 *  EMAIL only; the bell is never preference-gated. */
export const SWITCHABLE_EMAIL_KEYS = [
  "submission-receipt",
  "marks-released",
  "work-returned",
  "due-tomorrow",
  "due-reminder",
] as const;
export type SwitchableEmailKey = (typeof SWITCHABLE_EMAIL_KEYS)[number];

/** PATCH /api/auth/me's notificationPrefs shape — partial by design, and a
 *  z.object (NOT z.record: a zod record VALIDATES unknown keys against the
 *  enum and rejects them; an object with default-strip silently drops them,
 *  which is the wire behaviour every other schema here has). */
export const NotificationPrefsPatchSchema = z
  .object(Object.fromEntries(SWITCHABLE_EMAIL_KEYS.map((k) => [k, z.boolean()])) as Record<SwitchableEmailKey, z.ZodBoolean>)
  .partial();
