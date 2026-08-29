import { z } from "zod";
import { ACCOUNT_ROLES } from "./roles.js";
import { NotificationPrefsPatchSchema } from "./notifications.js";

/** Spec §3.1 — minimum password length. */
export const PASSWORD_MIN_LENGTH = 10;

/** Spec §3.1 — verbatim refusal shown to signup number cap+1. */
export const ACCOUNT_CAP_MESSAGE =
  "This site is at capacity — ask your teacher or the site owner.";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(PASSWORD_MIN_LENGTH).max(200);
const token = z.string().min(20).max(200);

export const SignupInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
  wantsTeacher: z.boolean(),
  /** Spec §11 — signup includes a consent step; it must be affirmative. */
  consent: z.literal(true),
});
export type SignupInput = z.infer<typeof SignupInputSchema>;

export const SigninInputSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});
export type SigninInput = z.infer<typeof SigninInputSchema>;

export const ConfirmInputSchema = z.object({ token });
export const ForgotInputSchema = z.object({ email });
export const ResetInputSchema = z.object({ token, password });
export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});
export const UpdateMeInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  notificationPrefs: NotificationPrefsPatchSchema.optional(),
});

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ACCOUNT_ROLES),
  isTeacher: z.boolean(),
  emailConfirmed: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
