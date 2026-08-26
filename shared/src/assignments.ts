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

export const GuideInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: InstructionsDocSchema,
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
