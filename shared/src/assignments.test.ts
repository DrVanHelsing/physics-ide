import { describe, test, expect } from "vitest";
import { BUILT_IN_RULE_SETS } from "./workspaceRules.js";
import {
  CreateAssignmentInputSchema,
  InstructionsDocSchema,
  EMPTY_INSTRUCTIONS_DOC,
  computeAssignmentPhase,
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
