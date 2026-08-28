import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import ShareDialog, { HANDOFF_SENTENCE, NO_SHARING_CLASSES, EMPTY_ROSTER } from "../ShareDialog";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";

/* Same idiom as assignmentsTab.test.js / assignmentPage.test.js: stub
   react-query's hooks directly rather than mounting a real
   QueryClientProvider. ShareDialog runs TWO useQuery calls (the class list,
   then — conditionally — the chosen class's roster), so the mock is keyed
   on queryKey, the same fix assignmentPage.test.js's mockQueries() uses for
   its own two-query page. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

/** Flushes the microtask queue past useMutation's mocked mutationFn chain —
 *  same idiom submitFlow.test.js / historyTimeline.test.js use. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const SHARING_CLASS = { id: "c1", name: "9B Physics", peerSharing: true, archived: false, myStatus: "active" };
const ROSTER = [
  { userId: "u2", name: "Naledi" },
  { userId: "u3", name: "Thabo" },
];

function mockQueries({ classes, roster }) {
  useQuery.mockImplementation(({ queryKey }) => {
    if (queryKey[1] === "roster") return { data: roster ? { members: roster } : undefined, isLoading: false };
    return { data: { classes }, isLoading: false };
  });
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(props = {}) {
  mounted = mountComponent(<ShareDialog projectId="p-1" onClose={vi.fn()} {...props} />);
  return mounted.container;
}

describe("ShareDialog (Plan 7)", () => {
  test("one sharing-on class + a two-member roster renders the roster radios and the consequence line verbatim", () => {
    mockQueries({ classes: [SHARING_CLASS], roster: ROSTER });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    const radios = [...container.querySelectorAll('input[name="shareRecipient"]')];
    expect(radios).toHaveLength(2);
    expect(container.textContent).toContain("Naledi");
    expect(container.textContent).toContain("Thabo");
    expect(byText(container, HANDOFF_SENTENCE, "p")).not.toBeNull();
  });

  test("zero sharing-on classes renders the no-classes sentence", () => {
    mockQueries({ classes: [], roster: null });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    expect(byText(container, NO_SHARING_CLASSES, "p")).not.toBeNull();
  });

  test("one sharing-on class whose roster is empty renders EMPTY_ROSTER and keeps Share disabled", () => {
    mockQueries({ classes: [SHARING_CLASS], roster: [] });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const container = render();
    expect(container.querySelectorAll('input[name="shareRecipient"]')).toHaveLength(0);
    const empty = byText(container, EMPTY_ROSTER, "p");
    expect(empty).not.toBeNull();
    expect(empty.className).toBe("empty");
    const shareBtn = byText(container, "Share", "button");
    expect(shareBtn.disabled).toBe(true);
  });

  test("choosing a recipient and pressing Share calls the mutation with { classId, recipientId, projectId }", async () => {
    mockQueries({ classes: [SHARING_CLASS], roster: ROSTER });
    useMutation.mockImplementation((opts) => ({
      mutate: (vars) => {
        Promise.resolve()
          .then(() => opts.mutationFn(vars))
          .then((data) => opts.onSuccess && opts.onSuccess(data, vars));
      },
      isPending: false,
      error: null,
    }));
    api.mockResolvedValue({ ok: true });

    const container = render({ projectId: "p-9" });
    const radios = [...container.querySelectorAll('input[name="shareRecipient"]')];
    click(radios[0]);
    click(byText(container, "Share", "button"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/shares", {
      method: "POST",
      body: { classId: "c1", recipientId: "u2", projectId: "p-9" },
    });
  });

  test("a mutation error renders in .alert--danger", () => {
    mockQueries({ classes: [SHARING_CLASS], roster: ROSTER });
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new Error("This class isn't part of your roster."),
    });

    const container = render();
    const alert = container.querySelector(".alert.alert--danger[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("This class isn't part of your roster.");
  });
});
