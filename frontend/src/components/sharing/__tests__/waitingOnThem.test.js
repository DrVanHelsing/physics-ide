import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import WaitingOnThem from "../WaitingOnThem";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";
import { relativeTime } from "../../../utils/relativeTime";

/* Same idiom as sharedWithYou.test.js: stub react-query's hooks and the api
   client directly rather than mounting a real provider. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

// Fixed, well-in-the-past timestamps (not "now"-relative) so relativeTime's
// output is deterministic regardless of when the suite runs.
const SHARE_1_CREATED_AT = new Date("2024-01-15T10:00:00Z").getTime();
const SHARE_2_CREATED_AT = new Date("2024-03-02T10:00:00Z").getTime();
const SHARE_3_CREATED_AT = new Date("2024-05-20T10:00:00Z").getTime();

const SHARES = [
  { id: "s-1", title: "Pendulum lab", recipientName: "Naledi", sharerName: "Me", createdAt: SHARE_1_CREATED_AT },
  { id: "s-2", title: "Free fall", recipientName: "Thabo", sharerName: "Me", createdAt: SHARE_2_CREATED_AT },
];
const TEACHER_SHARES = [
  { id: "s-3", title: "Orbit sim", recipientName: "Naledi", sharerName: "Zanele", createdAt: SHARE_3_CREATED_AT },
];

/** Flushes the microtask queue past the click handler's chain of awaits —
 *  same idiom sharedWithYou.test.js's caller uses. */
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
  mounted = mountComponent(<WaitingOnThem classId="c-1" {...props} />);
  return mounted.container;
}

function setup({ shares = SHARES, invalidateQueries = vi.fn() } = {}) {
  useQueryClient.mockReturnValue({ invalidateQueries });
  useQuery.mockReturnValue({ data: { shares } });
  return { invalidateQueries };
}

describe("WaitingOnThem (Plan 8 D§8)", () => {
  test("renders NOTHING when there is nothing pending", () => {
    setup({ shares: [] });

    const container = render();
    expect(container.firstChild).toBeNull();
  });

  test("two pending shares render title, 'to <recipientName>', and a Revoke button each — never the sharer's own name", () => {
    setup();

    const container = render();
    expect(container.textContent).toContain("Pendulum lab");
    expect(container.textContent).toContain("to Naledi");
    expect(container.textContent).toContain("Free fall");
    expect(container.textContent).toContain("to Thabo");
    expect(container.textContent).not.toContain("Me to Naledi");

    const rows = container.querySelectorAll(".share-row");
    expect(rows).toHaveLength(2);
    const buttons = [...container.querySelectorAll(".share-row button")];
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b.textContent.trim()).toBe("Revoke"));
  });

  // Final review M1 (design D§8: "recipient name, project title, sent-at"):
  // the route already returns createdAt — the component just never rendered
  // it, so a pending share had no visible age.
  test("each row renders its sent-at age, via the tree's relativeTime idiom", () => {
    setup();

    const container = render();
    const metas = [...container.querySelectorAll(".waiting-row__meta")].map((el) => el.textContent);
    expect(metas).toEqual([relativeTime(SHARE_1_CREATED_AT), relativeTime(SHARE_2_CREATED_AT)]);
  });

  test("teacher rows render '<sharerName> to <recipientName>' and their sent-at age", () => {
    setup({ shares: TEACHER_SHARES });

    const container = render({ isTeacher: true });
    expect(container.textContent).toContain("Zanele to Naledi");
    const meta = container.querySelector(".waiting-row__meta");
    expect(meta.textContent).toBe(relativeTime(SHARE_3_CREATED_AT));
  });

  test("clicking Revoke calls the mocked revoke mutation and invalidates the outgoing query", async () => {
    const { invalidateQueries } = setup();
    api.mockResolvedValue({ ok: true });

    const container = render();
    const button = byText(container, "Revoke", "button");
    click(button);
    await flush();

    expect(api).toHaveBeenCalledWith(`/api/shares/${SHARES[0].id}/revoke`, { method: "POST" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["class", "c-1", "outgoingShares"] });
  });

  test("a rejection renders its message in .alert--danger", async () => {
    setup();
    api.mockRejectedValue(new Error("Only the sharer or the class teacher can revoke a share."));

    const container = render();
    const button = byText(container, "Revoke", "button");
    click(button);
    await flush();

    const alert = container.querySelector(".alert.alert--danger[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Only the sharer or the class teacher can revoke a share.");
  });
});
