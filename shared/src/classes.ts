import { z } from "zod";
import { CLASS_ROLES } from "./roles.js";

/** Spec §3.3.2 — letters and digits chosen so none look alike (no I, L, O, 0, 1). */
export const CLASS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const CLASS_CODE_REGEX = new RegExp(
  `^[${CLASS_CODE_ALPHABET}]{3}-[${CLASS_CODE_ALPHABET}]{3}$`,
);

/** Uppercase, strip spaces/dashes, re-insert the canonical dash. */
export function normalizeClassCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[\s-]/g, "");
  return bare.length === 6 ? `${bare.slice(0, 3)}-${bare.slice(3)}` : bare;
}

export const JOIN_MODES = ["open", "approval", "paused"] as const;
export type JoinMode = (typeof JOIN_MODES)[number];

export const MEMBER_STATUSES = ["active", "waiting"] as const;

const email = z.string().trim().toLowerCase().email().max(254);
const token = z.string().min(20).max(200);

export const CreateClassInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subjectLabel: z.string().trim().min(1).max(60).optional(),
});

export const UpdateClassSettingsInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subjectLabel: z.string().trim().max(60).nullable().optional(),
  joinMode: z.enum(JOIN_MODES).optional(),
  peerSharing: z.boolean().optional(),
});

export const JoinByCodeInputSchema = z.object({
  code: z
    .string()
    .transform(normalizeClassCode)
    .refine((c) => CLASS_CODE_REGEX.test(c), { message: "That code doesn't look right." }),
});

export const InviteInputSchema = z.object({
  emails: z.array(email).min(1).max(50),
  role: z.enum(CLASS_ROLES),
});

export const AcceptInviteInputSchema = z.object({ token });
