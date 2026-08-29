import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { HealthTab, RETENTION_SENTENCE } from "../AdminConsole";
import { mountComponent, click, byText, mouseDown } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";

/* HealthTab calls useQuery() (TanStack Query) directly — stub it so this
   suite can mount the tab in isolation, the way HeaderAccount.test.js stubs
   useAuth for the same reason. useMutation/useQueryClient are stubbed too:
   the health list itself never calls them, but Task 8's RetentionControl
   (rendered inside HealthTab) does. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(data) {
  useQuery.mockReturnValue({ data });
  mounted = mountComponent(<HealthTab />);
  return mounted.container;
}

/* DataRequestsTab.test.js's own idiom, reused verbatim for the same reason:
   driving a controlled number input. */
function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Flushes past a mocked mutationFn/async handler chain. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("AdminConsole HealthTab — semantic status with a second channel (D13)", () => {
  test("healthy API renders .badge--success containing the word running, plus an svg", () => {
    const container = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const badge = container.querySelector(".badge--success");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("running");
    expect(badge.querySelector("svg")).not.toBeNull();
    // Neither state class appears on the other's badge — colour is not the
    // only channel, and the two never share a class.
    expect(badge.classList.contains("badge--danger")).toBe(false);
  });

  test("unhealthy API renders .badge--danger containing the word trouble, plus an svg", () => {
    const container = render({ ok: false, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const badge = container.querySelector(".badge--danger");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("trouble");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(badge.classList.contains("badge--success")).toBe(false);
  });

  test("the health list is wrapped in a .card surface", () => {
    const container = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const card = container.querySelector(".card");
    expect(card).not.toBeNull();
    expect(card.querySelector(".admin-health")).not.toBeNull();
  });
});

/* Task 4 / §10's second Health promise: "storage used" — rendered
   human-readable, not as a raw byte count. */
describe("AdminConsole HealthTab — storage used (§10)", () => {
  test("renders a human-readable size for a byte count in the MB range", () => {
    const container = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5, storageBytes: 15_728_640 });
    expect(container.textContent).toContain("Storage used");
    expect(container.textContent).toContain("15.0 MB");
  });

  test("renders bytes verbatim below 1 KB, and a whole-number KB just above it", () => {
    const bytesOnly = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5, storageBytes: 512 });
    expect(bytesOnly.textContent).toContain("512 B");

    mounted.unmount();
    const kb = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5, storageBytes: 2048 });
    expect(kb.textContent).toContain("2.0 KB");
  });
});

/* Task 8 — §11's retention clock. RetentionControl reads GET
   /api/admin/retention (retentionYears, wouldDelete) and lands in this same
   Health tab per the brief; render() feeds the SAME mocked object to every
   useQuery() call in the tree (health, the baseline retention read, and the
   confirm dialog's candidate preview), which is fine here since every case
   below only needs one wouldDelete figure at a time. */
describe("AdminConsole HealthTab — retention clock (Task 8, §11)", () => {
  const HEALTH = { ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5, storageBytes: 100 };

  test("shows the stored retention period, defaulting to 3 years when the setting is absent", () => {
    const container = render(HEALTH);
    const input = container.querySelector(".admin-retention-input");
    expect(input).not.toBeNull();
    expect(Number(input.value)).toBe(3);
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("years");
  });

  test("a stored value other than the default renders instead", () => {
    const container = render({ ...HEALTH, retentionYears: 7 });
    const input = container.querySelector(".admin-retention-input");
    expect(Number(input.value)).toBe(7);
  });

  test("Save is disabled until the input differs from the current value", () => {
    const container = render({ ...HEALTH, retentionYears: 5 });
    const saveBtn = byText(container, "Save retention period");
    expect(saveBtn.disabled).toBe(true);

    type(container.querySelector(".admin-retention-input"), "2");
    expect(saveBtn.disabled).toBe(false);
  });

  test("Save opens the product's one Overlay with the sentence verbatim, the live wouldDelete count, Cancel first, and no backdrop dismiss", () => {
    const container = render({ ...HEALTH, retentionYears: 5, wouldDelete: 7 });
    type(container.querySelector(".admin-retention-input"), "1");
    click(byText(container, "Save retention period"));

    const panel = container.querySelector(".erase-dialog");
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain(RETENTION_SENTENCE);
    expect(panel.textContent).toContain("7");

    const buttons = [...panel.querySelectorAll(".erase-dialog__actions button")];
    expect(buttons.map((b) => b.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Cancel",
      "Confirm change",
    ]);
    expect(buttons[1].className).toContain("btn--danger");

    mouseDown(container.querySelector(".overlay-backdrop"));
    expect(container.querySelector(".erase-dialog")).not.toBeNull();
  });

  test("Cancel closes the dialog without saving", () => {
    const container = render({ ...HEALTH, retentionYears: 5 });
    type(container.querySelector(".admin-retention-input"), "1");
    click(byText(container, "Save retention period"));
    expect(container.querySelector(".erase-dialog")).not.toBeNull();

    click(byText(container, "Cancel"));
    expect(container.querySelector(".erase-dialog")).toBeNull();
  });

  test("Confirm change fires the retention mutation with { retentionYears }", async () => {
    useQuery.mockReturnValue({ data: { ...HEALTH, retentionYears: 5, wouldDelete: 2 } });
    useMutation.mockImplementation((opts) => ({
      mutate: (vars) => {
        Promise.resolve().then(() => opts.mutationFn(vars));
      },
      isPending: false,
      error: null,
    }));
    api.mockResolvedValue({ ok: true, retentionYears: 1 });

    mounted = mountComponent(<HealthTab />);
    const container = mounted.container;
    type(container.querySelector(".admin-retention-input"), "1");
    click(byText(container, "Save retention period"));
    click(byText(container, "Confirm change"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/admin/retention", {
      method: "PUT",
      body: { retentionYears: 1 },
    });
  });

  test("a mutation error renders in .alert--danger inside the dialog", () => {
    useQuery.mockReturnValue({ data: { ...HEALTH, retentionYears: 5, wouldDelete: 2 } });
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("Retention period must be a whole number of years, 1–50."),
    });

    mounted = mountComponent(<HealthTab />);
    const container = mounted.container;
    type(container.querySelector(".admin-retention-input"), "1");
    click(byText(container, "Save retention period"));

    const panel = container.querySelector(".erase-dialog");
    const alert = panel.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Retention period must be a whole number of years, 1–50.");
  });
});
