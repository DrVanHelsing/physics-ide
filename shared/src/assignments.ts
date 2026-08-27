import { z } from "zod";
import { WorkspaceRulesSchema, BUILT_IN_RULE_SETS } from "./workspaceRules.js";

/** Spec §5.5 — who hands work in. */
export const SUBMISSION_MODES = ["individual", "pair", "group"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

/** The IDE's own goal vocabulary — Step 1's grep result, verbatim. */
export const ASSIGNMENT_PROJECT_TYPES = ["physics", "datascience", "hybrid"] as const;

/** D§7 — instruction images are capped inline data-URIs; no blob store. */
export const MAX_INSTRUCTIONS_IMAGE_BYTES = 200 * 1024;
export const MAX_INSTRUCTIONS_BYTES = 1024 * 1024;

export const EMPTY_INSTRUCTIONS_DOC: { type: "doc"; content: unknown[] } = { type: "doc", content: [] };


/**
 * A TipTap/ProseMirror document, validated structurally (type + content
 * tree), size-capped as serialized JSON, with every image node required
 * to be an in-cap data URI (D§7). We do NOT enumerate every node type —
 * the renderer ignores unknown nodes — we bound size and image sources.
 */
export const InstructionsDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).default([]) })
  .passthrough()
  .superRefine((doc, ctx) => {
    const raw = JSON.stringify(doc);
    if (raw.length > MAX_INSTRUCTIONS_BYTES) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instructions are too large — trim images." });
      return;
    }
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string; attrs?: { src?: string }; content?: unknown[] };
      if (n.type === "image") {
        const src = n.attrs?.src ?? "";
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(src)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Images must be embedded, not linked." });
        } else if (src.length > MAX_INSTRUCTIONS_IMAGE_BYTES * 1.4) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That image is too large (200 KB max)." });
        }
      }
      for (const child of n.content ?? []) walk(child);
    };
    for (const child of doc.content) walk(child);
  });

const epochMs = z.number().int().positive();

export const CreateAssignmentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    instructions: InstructionsDocSchema.default(EMPTY_INSTRUCTIONS_DOC),
    projectType: z.enum(ASSIGNMENT_PROJECT_TYPES).default(ASSIGNMENT_PROJECT_TYPES[0]),
    points: z.number().int().min(0).max(1000).nullable().default(null),
    submissionMode: z.enum(SUBMISSION_MODES).default("individual"),
    individualWork: z.boolean().default(false),
    opensAt: epochMs.nullable().default(null),
    dueAt: epochMs.nullable().default(null),
    lateUntil: epochMs.nullable().default(null),
    rules: WorkspaceRulesSchema.default(BUILT_IN_RULE_SETS.standard_classwork),
  })
  .superRefine((a, ctx) => {
    if (a.opensAt != null && a.dueAt != null && a.dueAt <= a.opensAt)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The due date must come after the open date." });
    if (a.lateUntil != null && (a.dueAt == null || a.lateUntil <= a.dueAt))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The late window must extend past the due date." });
    if (a.individualWork && a.submissionMode !== "individual")
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Individual work applies to individually-submitted assignments." });
  });

export const UpdateAssignmentInputSchema = CreateAssignmentInputSchema.innerType()
  .partial()
  .superRefine(() => {/* cross-field checks re-run in the route against the merged row */});

export const SaveRuleSetInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rules: WorkspaceRulesSchema,
});

export const MarkDraftInputSchema = z.object({
  points: z.number().int().min(0).max(1000).nullable().default(null),
  comment: z.string().max(5000).default(""),
  privateNote: z.string().max(5000).default(""),
});

/** Release names EITHER a list of students OR the whole assignment — never
 *  both (the two mean different things: `all` also stamps the assignment
 *  marks_released), never neither. An empty list stays a legal no-op: the
 *  caller named a selection, it just happened to be empty. */
export const MarksReleaseInputSchema = z
  .object({
    studentIds: z
      .array(z.string().min(1), { invalid_type_error: "Choose which students to release marks for." })
      .max(500, "That is too many students to release in one go.")
      .optional(),
    all: z.boolean({ invalid_type_error: "Release either a list of students or all of them." }).optional(),
  })
  .superRefine((v, ctx) => {
    const releaseAll = v.all === true;
    if (releaseAll && v.studentIds != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Release either a list of students or all of them, not both.",
      });
    }
    if (!releaseAll && v.studentIds == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose which students to release marks for." });
    }
  });

/** Return-for-changes: the comment is the whole point of the action — the
 *  student reads it in the email and on their assignment page — so it is
 *  required, trimmed, and capped like every other mark comment. */
export const MarkReturnInputSchema = z.object({
  comment: z
    .string({
      required_error: "Say what needs to change — the student sees this.",
      invalid_type_error: "Say what needs to change — the student sees this.",
    })
    .trim()
    .min(1, "Say what needs to change — the student sees this.")
    .max(5000, "That comment is too long."),
});

export const GuideInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: InstructionsDocSchema,
});

/** Forming a group (spec §5.5 "students group themselves from the class
 *  list"). The name is optional — the route auto-names "Group N" when the
 *  student just presses the button, which is the common case. */
export const CreateGroupInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the group a name.")
    .max(60, "That group name is too long.")
    .optional(),
});

/** The one sentence a malformed group save can produce — the same wording
 *  the personal engine's own project PUT uses for a manifest it can't read. */
const INVALID_PROJECT = "That doesn't look like a valid project.";

/** The baton-holder's save (plan Stage D). The manifest's full shape is the
 *  client's own contract — the personal sync engine's PUT owns that check —
 *  so this validates exactly what the group route itself reads: a real
 *  object carrying the epoch-ms `updatedAt` that becomes the row's
 *  clientUpdatedAt. Everything else passes through untouched. */
export const GroupProjectSaveInputSchema = z.object({
  manifest: z
    .object(
      {
        updatedAt: z
          .number({ required_error: INVALID_PROJECT, invalid_type_error: INVALID_PROJECT })
          .int(INVALID_PROJECT)
          .positive(INVALID_PROJECT),
      },
      { required_error: INVALID_PROJECT, invalid_type_error: INVALID_PROJECT },
    )
    .passthrough(),
});

/** Spec §5.1's life, computed from timestamps (D§6): stored states are
 * draft / published / marks_released; everything between derives. */
export function computeAssignmentPhase(
  a: {
    status: string;
    opensAt: Date | null;
    dueAt: Date | null;
    lateUntil: Date | null;
    closedAt: Date | null;
  },
  now: Date,
): "draft" | "scheduled" | "open" | "late_window" | "closed" | "marks_released" {
  if (a.status === "draft") return "draft";
  if (a.status === "marks_released") return "marks_released";
  if (a.closedAt && a.closedAt <= now) return "closed";
  if (a.opensAt && now < a.opensAt) return "scheduled";
  if (a.dueAt && now >= a.dueAt) {
    if (a.lateUntil && now < a.lateUntil) return "late_window";
    return "closed";
  }
  return "open";
}
