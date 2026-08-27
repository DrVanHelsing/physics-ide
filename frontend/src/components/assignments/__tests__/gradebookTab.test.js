import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import GradebookTab, { gradebookCsvString } from "../GradebookTab";
import { mountComponent, byText } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";

/* Same idiom as guides.test.js: stub react-query's hooks and the API
   client directly rather than mounting real providers, and stub
   ClassChrome so this file owns exactly the gradebook body's behaviour —
   ClassChrome's own tab-switching is classTabs.test.js's job. */
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", name: "Physics 101", myRole: "teacher" }, { id: "u1" }),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function renderTab() {
  mounted = mountComponent(<GradebookTab />);
  return mounted.container;
}

const STUDENTS = [
  { id: "s1", name: "Amy Chen" },
  { id: "s2", name: "Wolfe, Zach" },
];
const ASSIGNMENTS = [
  { id: "a1", title: 'Zeta "Big" Lab', points: 10 },
  { id: "a2", title: "Alpha Lab", points: null },
];
const CELLS = [
  { studentId: "s1", assignmentId: "a1", points: 8, released: true, late: true, missing: false },
  { studentId: "s1", assignmentId: "a2", points: null, released: false, late: false, missing: true },
  { studentId: "s2", assignmentId: "a1", points: 1, released: false, late: false, missing: false },
  { studentId: "s2", assignmentId: "a2", points: 1, released: true, late: false, missing: false },
];

describe("gradebookCsvString — the pure CSV builder", () => {
  test("exact string for a two-student fixture: quoting (incl. a comma AND an inner quote in a name/title), the BOM-free body, late + draft suffixes, the points-less checkmark", () => {
    const cellByKey = new Map(CELLS.map((c) => [`${c.studentId}:${c.assignmentId}`, c]));
    const csv = gradebookCsvString({ students: STUDENTS, assignments: ASSIGNMENTS, cellByKey });

    const expected =
      '"Student","Zeta ""Big"" Lab (/10)","Alpha Lab (/✓)"\r\n' +
      '"Amy Chen","8 (late)","—"\r\n' +
      '"Wolfe, Zach","1 (draft)","✓"';
    expect(csv).toBe(expected);
  });
});

describe("GradebookTab — the grid", () => {
  test("renders students down, assignments across, with the (/points) or (/✓) header", () => {
    useQuery.mockReturnValue({
      data: { students: STUDENTS, assignments: ASSIGNMENTS, cells: CELLS },
      error: null,
      isLoading: false,
    });
    const container = renderTab();

    const headers = [...container.querySelectorAll(".admin-table thead th")].map((th) =>
      th.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(headers).toEqual(["Student", 'Zeta "Big" Lab (/10)', "Alpha Lab (/✓)"]);

    const rows = [...container.querySelectorAll(".admin-table tbody tr")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector("td").textContent).toBe("Amy Chen");
    expect(rows[1].querySelector("td").textContent).toBe("Wolfe, Zach");
  });

  test("a missing cell reads em dash; a released numeric mark shows the points; a late submission carries a text badge, not just colour", () => {
    useQuery.mockReturnValue({
      data: { students: STUDENTS, assignments: ASSIGNMENTS, cells: CELLS },
      error: null,
      isLoading: false,
    });
    const container = renderTab();

    const amyRow = [...container.querySelectorAll(".admin-table tbody tr")][0];
    const cells = [...amyRow.querySelectorAll("td")];
    // Zeta Lab: 8, late.
    expect(cells[1].textContent).toContain("8");
    const lateBadge = cells[1].querySelector(".badge.badge--warning");
    expect(lateBadge).not.toBeNull();
    expect(lateBadge.textContent).toBe("late");
    // Alpha Lab: missing.
    expect(cells[2].textContent.trim()).toBe("—");
  });

  test("a draft mark (unreleased) is flagged with a text badge, not colour alone; a points-less released mark shows a checkmark", () => {
    useQuery.mockReturnValue({
      data: { students: STUDENTS, assignments: ASSIGNMENTS, cells: CELLS },
      error: null,
      isLoading: false,
    });
    const container = renderTab();

    const zachRow = [...container.querySelectorAll(".admin-table tbody tr")][1];
    const cells = [...zachRow.querySelectorAll("td")];
    // Zeta Lab: 1, draft (unreleased).
    expect(cells[1].textContent).toContain("1");
    const draftBadge = cells[1].querySelector(".badge.badge--warning");
    expect(draftBadge).not.toBeNull();
    expect(draftBadge.textContent).toBe("draft");
    // Alpha Lab (points-less, released): checkmark, no badge.
    expect(cells[2].textContent.trim()).toBe("✓");
    expect(cells[2].querySelector(".badge")).toBeNull();
  });

  test("no students yet -> the empty state, no table", () => {
    useQuery.mockReturnValue({
      data: { students: [], assignments: [], cells: [] },
      error: null,
      isLoading: false,
    });
    const container = renderTab();
    expect(container.querySelector(".admin-table")).toBeNull();
    const empty = container.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("No students yet — the grid fills in once your roster does.");
  });

  test("a query error surfaces as an alert (e.g. the 403 a student would somehow hit)", () => {
    useQuery.mockReturnValue({
      data: undefined,
      error: { message: "Teachers and assistants only." },
      isLoading: false,
    });
    const container = renderTab();
    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Teachers and assistants only.");
  });

  test("the table sits inside its own .admin-table-wrap so the page never scrolls horizontally", () => {
    useQuery.mockReturnValue({
      data: { students: STUDENTS, assignments: ASSIGNMENTS, cells: CELLS },
      error: null,
      isLoading: false,
    });
    const container = renderTab();
    const wrap = container.querySelector(".admin-table-wrap");
    expect(wrap).not.toBeNull();
    expect(wrap.querySelector(".admin-table")).not.toBeNull();
  });

  test("Export CSV downloads a file named '<class name> gradebook.csv'", () => {
    useQuery.mockReturnValue({
      data: { students: STUDENTS, assignments: ASSIGNMENTS, cells: CELLS },
      error: null,
      isLoading: false,
    });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const container = renderTab();
    const button = byText(container, "Export CSV");
    expect(button).not.toBeNull();
    button.click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  test("Export CSV is disabled when there are no students", () => {
    useQuery.mockReturnValue({
      data: { students: [], assignments: [], cells: [] },
      error: null,
      isLoading: false,
    });
    const container = renderTab();
    const button = byText(container, "Export CSV");
    expect(button.disabled).toBe(true);
  });
});
