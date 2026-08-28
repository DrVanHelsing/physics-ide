import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import SharedWithYou from "../SharedWithYou";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { acceptShare } from "../../../utils/sharing/acceptShare";

/* Same idiom as shareDialog.test.js / submitFlow.test.js: stub react-query's
   hooks and useMe() directly rather than mounting a real provider. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("../../../utils/sharing/acceptShare", () => ({ acceptShare: vi.fn() }));

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateSpy,
}));

const ME = { id: "u-me" };
const SHARES = [
  { id: "s-1", title: "Pendulum lab", sharerName: "Naledi" },
  { id: "s-2", title: "Free fall", sharerName: "Thabo" },
];

/** Flushes the microtask queue past the click handler's chain of awaits —
 *  same idiom submitFlow.test.js / startWork.test.js's callers use. */
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
  mounted = mountComponent(<SharedWithYou classId="c-1" {...props} />);
  return mounted.container;
}

function setup({ shares = SHARES, invalidateQueries = vi.fn() } = {}) {
  useMe.mockReturnValue({ data: ME });
  useQueryClient.mockReturnValue({ invalidateQueries });
  useQuery.mockReturnValue({ data: { shares } });
  return { invalidateQueries };
}

describe("SharedWithYou (Plan 7 — D§6)", () => {
  test("renders NOTHING when there is nothing pending", () => {
    setup({ shares: [] });

    const container = render();
    expect(container.firstChild).toBeNull();
  });

  test("two pending shares render title, 'from <name>', and an Add-to-my-projects button each", () => {
    setup();

    const container = render();
    expect(container.textContent).toContain("Pendulum lab");
    expect(container.textContent).toContain("from Naledi");
    expect(container.textContent).toContain("Free fall");
    expect(container.textContent).toContain("from Thabo");

    const rows = container.querySelectorAll(".share-row");
    expect(rows).toHaveLength(2);
    const buttons = [...container.querySelectorAll(".share-row button")];
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b.textContent.trim()).toBe("Add to my projects"));
  });

  test("clicking Add calls the mocked acceptShare with the share and navigates to \"/\"", async () => {
    setup();
    acceptShare.mockResolvedValue("p-fresh-1");

    const container = render();
    const button = byText(container, "Add to my projects", "button");
    click(button);
    await flush();

    expect(acceptShare).toHaveBeenCalledWith(SHARES[0], ME);
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  test("a rejection renders its message in .alert--danger", async () => {
    setup();
    acceptShare.mockRejectedValue(new Error("You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it."));

    const container = render();
    const button = byText(container, "Add to my projects", "button");
    click(button);
    await flush();

    const alert = container.querySelector(".alert.alert--danger[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe(
      "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.",
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
