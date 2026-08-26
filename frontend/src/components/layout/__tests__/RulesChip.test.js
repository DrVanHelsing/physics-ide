import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import RulesChip from "../RulesChip";
import { mountComponent } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";

/* RulesChip calls useAssignmentContext() directly — stub it, following
   SyncChip.test.js's useMe()-stubbing pattern for the same shape of hook. */
vi.mock("../../../contexts/AssignmentContext", () => ({
  useAssignmentContext: vi.fn(),
}));

const OPEN_PRACTICE = { editors: "both", debug: true, importFiles: true, exportAndCopy: true, advancedBlocks: true, templates: true };

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

describe("RulesChip — the workspace-rules note (spec §5.4)", () => {
  test("no assignment context: renders nothing", () => {
    useAssignmentContext.mockReturnValue(null);
    mounted = mountComponent(<RulesChip />);
    expect(mounted.container.querySelector(".rules-chip")).toBeNull();
  });

  test("switches off: lists them, matching the spec's own example verbatim", () => {
    useAssignmentContext.mockReturnValue({
      assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null,
      rules: { ...OPEN_PRACTICE, importFiles: false, exportAndCopy: false },
    });
    mounted = mountComponent(<RulesChip />);
    const chip = mounted.container.querySelector(".rules-chip");
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("Your teacher has turned off: import, export & copy");
  });

  test("editors restricted to one surface: 'blocks only' / 'code only' joins the same list", () => {
    useAssignmentContext.mockReturnValue({
      assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null,
      rules: { ...OPEN_PRACTICE, editors: "blocks" },
    });
    mounted = mountComponent(<RulesChip />);
    expect(mounted.container.querySelector(".rules-chip").textContent).toBe(
      "Your teacher has turned off: blocks only",
    );

    useAssignmentContext.mockReturnValue({
      assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null,
      rules: { ...OPEN_PRACTICE, editors: "code" },
    });
    mounted.rerender(<RulesChip />);
    expect(mounted.container.querySelector(".rules-chip").textContent).toBe(
      "Your teacher has turned off: code only",
    );
  });

  test("nothing off: reads 'Assignment: <title>' so a student always knows they're inside assignment work", () => {
    useAssignmentContext.mockReturnValue({
      assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null,
      rules: OPEN_PRACTICE,
    });
    mounted = mountComponent(<RulesChip />);
    expect(mounted.container.querySelector(".rules-chip").textContent).toBe("Assignment: Pendulum Lab");
  });

  test("role, aria-live, and the title attribute carry the full sentence (never truncated, unlike the visible text)", () => {
    useAssignmentContext.mockReturnValue({
      assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null,
      rules: { editors: "both", debug: false, importFiles: false, exportAndCopy: false, advancedBlocks: false, templates: false },
    });
    mounted = mountComponent(<RulesChip />);
    const chip = mounted.container.querySelector(".rules-chip");
    expect(chip.getAttribute("role")).toBe("status");
    expect(chip.getAttribute("aria-live")).toBe("polite");
    expect(chip.getAttribute("title")).toBe(
      "Your teacher has turned off: debug mode, import, export & copy, advanced blocks, templates",
    );
    expect(chip.className).toBe("sync-chip rules-chip");
  });
});
