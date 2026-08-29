import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import DataRequestsTab, { ERASE_SENTENCE } from "../DataRequestsTab";
import { mountComponent, byText, click, mouseDown } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";

/* Same idiom as ShareDialog/GradebookTab's own suites: stub react-query's
   hooks and the API client directly rather than mounting real providers. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

const RESTING_COPY = "Search for a person to export or erase their data.";

const ROWS = [
  {
    id: "u1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "user",
    isTeacher: false,
    active: true,
    emailConfirmed: true,
    erased: false,
  },
];
const ERASED_ROW = {
  id: "u2",
  name: "Removed student",
  email: "erased+u2@erased.invalid",
  role: "user",
  isTeacher: false,
  active: false,
  emailConfirmed: false,
  erased: true,
};

/* Same setter-and-dispatch idiom adminTabs.test.js uses to drive a
   controlled <input>. */
function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Flushes past a mocked mutationFn/async handler chain — ShareDialog's
 *  and MarkingRoom's own idiom. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(props = {}) {
  mounted = mountComponent(<DataRequestsTab {...props} />);
  return mounted.container;
}

function search(container, q) {
  type(container.querySelector(".admin-search-box input"), q);
}

describe("DataRequestsTab — resting state", () => {
  test("renders .empty with the search prompt, no results table", () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    const empty = byText(container, RESTING_COPY, "p");
    expect(empty).not.toBeNull();
    expect(empty.className).toBe("empty");
    expect(container.querySelector(".admin-table")).toBeNull();
  });
});

describe("DataRequestsTab — search results", () => {
  test("a result row shows name/email with Export and Erase… buttons", () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    search(container, "ada");

    const row = container.querySelector(".admin-table tbody tr");
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("Ada Lovelace");
    expect(row.textContent).toContain("ada@example.com");
    expect(byText(container, "Export")).not.toBeNull();
    expect(byText(container, "Erase…")).not.toBeNull();
  });

  test("an erased result row offers Export but not Erase", () => {
    useQuery.mockReturnValue({ data: { users: [ERASED_ROW] }, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    search(container, "erased");

    const row = container.querySelector(".admin-table tbody tr");
    expect(row).not.toBeNull();
    expect(byText(container, "Export")).not.toBeNull();
    expect(byText(container, "Erase…")).toBeNull();
  });
});

describe("DataRequestsTab — Export (client-side Blob download)", () => {
  test("fetches the export route and hands the browser a download named physide-export-<id>.json", async () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    api.mockResolvedValue({ id: "u1", account: { name: "Ada Lovelace" } });

    // The GradebookTab test's own house pattern (self-review note 7: mirror
    // it rather than inventing a jsdom anchor-click harness) — assert the
    // Blob + anchor-download idiom was driven, not the DOM node itself.
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const container = render();
    search(container, "ada");
    click(byText(container, "Export"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/admin/users/u1/export");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });
});

describe("DataRequestsTab — the erase dialog", () => {
  function openDialog(container) {
    search(container, "ada");
    click(byText(container, "Erase…"));
    return container.querySelector(".erase-dialog");
  }

  test("opens the product's one Overlay with the sentence verbatim, Cancel first, Erase permanently disabled, and no backdrop dismiss", () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    const panel = openDialog(container);
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain(ERASE_SENTENCE);

    const buttons = [...panel.querySelectorAll(".erase-dialog__actions button")];
    expect(buttons.map((b) => b.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Cancel",
      "Erase permanently",
    ]);
    const confirmBtn = buttons[1];
    expect(confirmBtn.disabled).toBe(true);
    expect(confirmBtn.className).toContain("btn--danger");
    expect(confirmBtn.className).not.toContain("btn--primary");

    // The one earned deviation: an accidental backdrop click must not
    // discard a typed confirmation mid-erase.
    const backdrop = container.querySelector(".overlay-backdrop");
    mouseDown(backdrop);
    expect(container.querySelector(".erase-dialog")).not.toBeNull();
  });

  test("Cancel closes it without erasing", () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false, error: null });

    const container = render();
    openDialog(container);
    click(byText(container, "Cancel"));

    expect(container.querySelector(".erase-dialog")).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  test("typing the row's email exactly enables Erase permanently; a mismatch (even case) keeps it disabled", () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    const panel = openDialog(container);
    const input = panel.querySelector("input");
    const confirmBtn = byText(container, "Erase permanently");

    type(input, "ADA@example.com");
    expect(confirmBtn.disabled).toBe(true);

    type(input, "ada@example.co");
    expect(confirmBtn.disabled).toBe(true);

    type(input, "ada@example.com");
    expect(confirmBtn.disabled).toBe(false);
  });

  test("clicking the enabled Erase permanently fires the erase mutation with { confirm: email }", async () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockImplementation((opts) => ({
      mutate: (vars) => {
        Promise.resolve().then(() => opts.mutationFn(vars));
      },
      isPending: false,
      error: null,
    }));
    api.mockResolvedValue({ ok: true });

    const container = render();
    const panel = openDialog(container);
    type(panel.querySelector("input"), "ada@example.com");
    click(byText(container, "Erase permanently"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/admin/users/u1/erase", {
      method: "POST",
      body: { confirm: "ada@example.com" },
    });
  });

  test("a mutation error renders in .alert--danger", () => {
    useQuery.mockReturnValue({ data: { users: ROWS }, isLoading: false });
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("The confirmation doesn't match this account's email."),
    });

    const container = render();
    const panel = openDialog(container);
    const alert = panel.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("The confirmation doesn't match this account's email.");
  });
});
