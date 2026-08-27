import { describe, test, expect } from "vitest";
import { BUILT_IN_RULE_SETS } from "./workspaceRules.js";
import {
  CreateAssignmentInputSchema,
  InstructionsDocSchema,
  EMPTY_INSTRUCTIONS_DOC,
  computeAssignmentPhase,
  MarksReleaseInputSchema,
  MarkReturnInputSchema,
  MAX_INSTRUCTIONS_IMAGE_BYTES,
} from "./assignments.js";

describe("CreateAssignmentInputSchema", () => {
  test("title is the only required field; defaults land", () => {
    const parsed = CreateAssignmentInputSchema.parse({ title: "Projectile lab" });
    expect(parsed.submissionMode).toBe("individual");
    expect(parsed.rules).toEqual(BUILT_IN_RULE_SETS.standard_classwork);
    expect(parsed.points).toBeNull();
    expect(parsed.instructions).toEqual(EMPTY_INSTRUCTIONS_DOC);
  });

  test("due date must follow open date; late window must follow due", () => {
    const base = { title: "t", opensAt: 2000, dueAt: 1000 };
    expect(CreateAssignmentInputSchema.safeParse(base).success).toBe(false);
    const late = { title: "t", dueAt: 2000, lateUntil: 1500 };
    expect(CreateAssignmentInputSchema.safeParse(late).success).toBe(false);
  });
});

describe("InstructionsDocSchema", () => {
  test("accepts a doc with text and a small data-URI image", () => {
    const png = "data:image/png;base64," + "A".repeat(100);
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Read this." }] },
        { type: "image", attrs: { src: png, alt: "setup" } },
      ],
    };
    expect(InstructionsDocSchema.safeParse(doc).success).toBe(true);
  });

  test("rejects an image over the per-image cap and any non-data image src", () => {
    const big = "data:image/png;base64," + "A".repeat(MAX_INSTRUCTIONS_IMAGE_BYTES * 2);
    const overCap = { type: "doc", content: [{ type: "image", attrs: { src: big } }] };
    expect(InstructionsDocSchema.safeParse(overCap).success).toBe(false);
    const remote = { type: "doc", content: [{ type: "image", attrs: { src: "https://x.test/a.png" } }] };
    expect(InstructionsDocSchema.safeParse(remote).success).toBe(false);
  });
});

describe("MarksReleaseInputSchema", () => {
  const firstMessage = (body: unknown) => MarksReleaseInputSchema.safeParse(body);

  test("a student list alone parses; all: true alone parses; an empty list is a legal no-op", () => {
    expect(MarksReleaseInputSchema.parse({ studentIds: ["s1", "s2"] }).studentIds).toEqual(["s1", "s2"]);
    expect(MarksReleaseInputSchema.parse({ all: true }).all).toBe(true);
    expect(MarksReleaseInputSchema.safeParse({ studentIds: [] }).success).toBe(true);
  });

  test("neither and both are refused, each with a real sentence", () => {
    const neither = firstMessage({});
    expect(neither.success).toBe(false);
    expect(neither.error!.issues[0].message).toBe("Choose which students to release marks for.");

    const both = firstMessage({ all: true, studentIds: ["s1"] });
    expect(both.success).toBe(false);
    expect(both.error!.issues[0].message).toBe("Release either a list of students or all of them, not both.");
  });

  test("studentIds must be strings, and the list is capped", () => {
    expect(firstMessage({ studentIds: "s1" }).success).toBe(false);
    expect(firstMessage({ studentIds: [""] }).success).toBe(false);
    expect(firstMessage({ studentIds: Array.from({ length: 501 }, (_, i) => `s${i}`) }).success).toBe(false);
  });
});

describe("MarkReturnInputSchema", () => {
  test("a comment is required, trimmed, and capped — each refusal a real sentence", () => {
    expect(MarkReturnInputSchema.parse({ comment: "  Redo part 2.  " }).comment).toBe("Redo part 2.");

    const missing = MarkReturnInputSchema.safeParse({});
    expect(missing.success).toBe(false);
    expect(missing.error!.issues[0].message).toBe("Say what needs to change — the student sees this.");

    const blank = MarkReturnInputSchema.safeParse({ comment: "   " });
    expect(blank.success).toBe(false);
    expect(blank.error!.issues[0].message).toBe("Say what needs to change — the student sees this.");

    const long = MarkReturnInputSchema.safeParse({ comment: "x".repeat(5001) });
    expect(long.success).toBe(false);
    expect(long.error!.issues[0].message).toBe("That comment is too long.");
  });
});

describe("computeAssignmentPhase", () => {
  const t = (n: number) => new Date(n);
  const base = { status: "published", opensAt: t(100), dueAt: t(200), lateUntil: t(300), closedAt: null as Date | null };
  test("walks the life: scheduled -> open -> late_window -> closed", () => {
    expect(computeAssignmentPhase(base, t(50))).toBe("scheduled");
    expect(computeAssignmentPhase(base, t(150))).toBe("open");
    expect(computeAssignmentPhase(base, t(250))).toBe("late_window");
    expect(computeAssignmentPhase(base, t(350))).toBe("closed");
  });
  test("draft and marks_released are stored states and win outright", () => {
    expect(computeAssignmentPhase({ ...base, status: "draft" }, t(150))).toBe("draft");
    expect(computeAssignmentPhase({ ...base, status: "marks_released" }, t(150))).toBe("marks_released");
  });
  test("a manual close wins over open dates; no dueAt means open until closed", () => {
    expect(computeAssignmentPhase({ ...base, closedAt: t(120) }, t(150))).toBe("closed");
    expect(computeAssignmentPhase({ ...base, dueAt: null, lateUntil: null }, t(9999))).toBe("open");
  });
});
