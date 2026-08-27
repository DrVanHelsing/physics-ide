import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import InboxPage from "../InboxPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../../utils/api/client";

/* Same idiom as assignmentPage.test.js / guides.test.js: stub react-query's
   hooks directly rather than mounting a real QueryClientProvider, mock the
   api client (so the real remind mutationFn can run against a controlled
   resolved value instead of hitting real fetch), mock react-router-dom's
   params, and stub ClassChrome down to a bare render-prop shell (myRole
   flips per test via this mutable holder). */
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const { paramsHolder } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", aid: "a1" },
}));
vi.mock("react-router-dom", () => ({
  useParams: () => paramsHolder,
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const { roleHolder } = vi.hoisted(() => ({ roleHolder: { myRole: "teacher" } }));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", myRole: roleHolder.myRole }, { id: "u1" }),
}));

function inboxData(overrides = {}) {
  return {
    phase: "open",
    rows: [
      {
        studentId: "s1",
        name: "Alice",
        state: "submitted",
        late: false,
        submittedAt: 1700000000000,
        attempt: 1,
        markStatus: "released",
      },
      {
        studentId: "s2",
        name: "Bob",
        state: "submitted",
        late: true,
        submittedAt: 1700000100000,
        attempt: 2,
        markStatus: "draft",
      },
      {
        studentId: "s3",
        name: "Cleo",
        state: "missing",
        late: false,
        submittedAt: null,
        attempt: null,
        markStatus: "none",
      },
    ],
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let mounted = null;
let mutateSpy;

beforeEach(() => {
  roleHolder.myRole = "teacher";
  paramsHolder.id = "c1";
  paramsHolder.aid = "a1";
  useQuery.mockReturnValue({ data: inboxData(), error: null, isLoading: false });
  api.mockResolvedValue({ reminded: 1 });
  mutateSpy = vi.fn();
  useMutation.mockImplementation((opts) => ({
    mutate: (vars) => {
      mutateSpy(vars);
      Promise.resolve()
        .then(() => opts.mutationFn(vars))
        .then((data) => opts.onSuccess && opts.onSuccess(data, vars))
        .catch((err) => opts.onError && opts.onError(err));
    },
    isPending: false,
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

function render() {
  mounted = mountComponent(<InboxPage />);
  return mounted.container;
}

describe("InboxPage — staff gate", () => {
  test("a student is refused, not shown the roster", () => {
    roleHolder.myRole = "student";
    const container = render();
    expect(container.textContent).toContain("Teachers and assistants only.");
    expect(byText(container, "Alice", "a")).toBeNull();
  });

  test("a TA can view the roster", () => {
    roleHolder.myRole = "ta";
    const container = render();
    expect(byText(container, "Alice", "a")).not.toBeNull();
  });

  test("a teacher can view the roster", () => {
    roleHolder.myRole = "teacher";
    const container = render();
    expect(byText(container, "Alice", "a")).not.toBeNull();
  });
});

describe("InboxPage — progress line and bar", () => {
  test("shows 'N of M submitted' (late counts as submitted) and a proportional bar fill", () => {
    const container = render();
    expect(container.textContent).toContain("2 of 3 submitted");
    const bar = container.querySelector(".inbox-progress-bar");
    expect(bar.getAttribute("aria-valuenow")).toBe("67");
    const fill = container.querySelector(".inbox-progress-bar__fill");
    expect(fill.style.width).toBe("67%");
  });
});

describe("InboxPage — roster rows", () => {
  test("renders every row with state, mark status, attempt, and a link into the marking room", () => {
    const container = render();
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).toContain("Cleo");

    const aliceLink = byText(container, "Alice", "a");
    expect(aliceLink.getAttribute("href")).toBe("/classes/c1/assignments/a1/marking/s1");

    expect(byText(container, "released", "span")).not.toBeNull();
    expect(byText(container, "draft", "span")).not.toBeNull();
    expect(byText(container, "late", "span")).not.toBeNull();
  });

  test("phase 'open': a missing row reads 'not yet submitted'", () => {
    useQuery.mockReturnValue({ data: inboxData({ phase: "open" }), error: null, isLoading: false });
    const container = render();
    expect(byText(container, "not yet submitted", "span")).not.toBeNull();
    expect(byText(container, "missing", "span")).toBeNull();
  });

  test("phase 'closed': the same missing row reads 'missing'", () => {
    useQuery.mockReturnValue({ data: inboxData({ phase: "closed" }), error: null, isLoading: false });
    const container = render();
    expect(byText(container, "missing", "span")).not.toBeNull();
    expect(byText(container, "not yet submitted", "span")).toBeNull();
  });
});

describe("InboxPage — filter tabs", () => {
  test("defaults to All, with aria-current on the All tab", () => {
    const container = render();
    const allTab = byText(container, "All");
    expect(allTab.getAttribute("aria-current")).toBe("page");
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Cleo");
  });

  test("Late narrows to only the late submitted row", () => {
    const container = render();
    click(byText(container, "Late"));
    expect(container.textContent).not.toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).not.toContain("Cleo");
    expect(byText(container, "Late").getAttribute("aria-current")).toBe("page");
  });

  test("Missing narrows to only the missing row", () => {
    const container = render();
    click(byText(container, "Missing"));
    expect(container.textContent).not.toContain("Alice");
    expect(container.textContent).not.toContain("Bob");
    expect(container.textContent).toContain("Cleo");
  });

  test("Marked narrows to rows with a non-'none' markStatus", () => {
    const container = render();
    click(byText(container, "Marked"));
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).not.toContain("Cleo");
  });

  test("Submitted narrows to both submitted rows (late included)", () => {
    const container = render();
    click(byText(container, "Submitted"));
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).not.toContain("Cleo");
  });
});

describe("InboxPage — remind", () => {
  test("teacher: the button is disabled when nothing is missing", () => {
    useQuery.mockReturnValue({
      data: inboxData({ rows: inboxData().rows.filter((r) => r.state !== "missing") }),
      error: null,
      isLoading: false,
    });
    const container = render();
    const btn = byText(container, "Remind");
    expect(btn.disabled).toBe(true);
  });

  test("TA does not see the Remind control at all", () => {
    roleHolder.myRole = "ta";
    const container = render();
    expect(byText(container, "Remind")).toBeNull();
  });

  test("clicking Remind confirms with the exact consequence sentence before firing", async () => {
    const container = render();
    click(byText(container, "Remind"));
    await flush();

    expect(window.confirm).toHaveBeenCalledWith("Email 1 students who have not submitted?");
    expect(mutateSpy).toHaveBeenCalled();
  });

  test("declining the confirm does not fire the mutation", async () => {
    window.confirm.mockReturnValue(false);
    const container = render();
    click(byText(container, "Remind"));
    await flush();

    expect(window.confirm).toHaveBeenCalled();
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  test("a successful remind shows the reminded count", async () => {
    const container = render();
    click(byText(container, "Remind"));
    await flush();

    const alert = container.querySelector(".alert.alert--success");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Reminded 1 student.");
    expect(api).toHaveBeenCalledWith("/api/assignments/a1/remind", { method: "POST", body: {} });
  });
});

describe("InboxPage — Release all (Task 18)", () => {
  test("TA does not see the Release all control at all", () => {
    roleHolder.myRole = "ta";
    const container = render();
    expect(byText(container, "Release all")).toBeNull();
  });

  test("clicking Release all confirms with the exact consequence sentence, then POSTs { all: true }", async () => {
    api.mockResolvedValueOnce({ released: ["s1", "s2"], refused: [] });
    const container = render();
    click(byText(container, "Release all"));
    await flush();

    expect(window.confirm).toHaveBeenCalledWith(
      "Release all marks for this assignment? Students will be notified by email.",
    );
    expect(api).toHaveBeenCalledWith("/api/assignments/a1/marks/release", {
      method: "POST",
      body: { all: true },
    });
  });

  test("declining the confirm does not fire the mutation", async () => {
    window.confirm.mockReturnValue(false);
    const container = render();
    click(byText(container, "Release all"));
    await flush();

    expect(window.confirm).toHaveBeenCalled();
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  test("a successful release-all shows the released count", async () => {
    api.mockResolvedValueOnce({ released: ["s1", "s2"], refused: [] });
    const container = render();
    click(byText(container, "Release all"));
    await flush();

    const alert = container.querySelector(".alert.alert--success");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Released 2 marks.");
  });

  test("a partial release (some rows refused as stale) is called out in the same note", async () => {
    api.mockResolvedValueOnce({
      released: ["s1"],
      refused: [{ studentId: "s2", error: "This draft was written against a previous attempt — re-save it before releasing." }],
    });
    const container = render();
    click(byText(container, "Release all"));
    await flush();

    const alert = container.querySelector(".alert.alert--success");
    expect(alert.textContent).toBe("Released 1 mark. 1 skipped — written against a previous attempt.");
  });

  test("a server error surfaces as an alert--danger", async () => {
    api.mockRejectedValueOnce(new Error("Teachers only for this class."));
    const container = render();
    click(byText(container, "Release all"));
    await flush();

    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Teachers only for this class.");
  });
});

/* Task 23, spec §5.5: group work hands in once, so the inbox row IS the
   group — "one row per group (members named)". A rostered student who never
   joined one still gets a row of their own; they are exactly who a reminder
   is for. */
describe("InboxPage — group rows (Task 23)", () => {
  function groupInboxData() {
    return {
      phase: "closed",
      rows: [
        {
          kind: "group",
          studentId: null,
          groupId: "g1",
          name: "The Pair",
          members: [
            { userId: "s1", name: "Alice" },
            { userId: "s2", name: "Bob" },
          ],
          state: "submitted",
          late: false,
          submittedAt: 1700000000000,
          attempt: 1,
          markStatus: "draft",
        },
        {
          kind: "group",
          studentId: null,
          groupId: "g2",
          name: "The Solo",
          members: [
            { userId: "s3", name: "Cleo" },
            { userId: "s5", name: "Eve" },
          ],
          state: "missing",
          late: false,
          submittedAt: null,
          attempt: null,
          markStatus: "none",
        },
        {
          kind: "student",
          studentId: "s4",
          groupId: null,
          name: "Dee",
          members: [],
          state: "missing",
          late: false,
          submittedAt: null,
          attempt: null,
          markStatus: "none",
        },
      ],
    };
  }

  beforeEach(() => {
    useQuery.mockReturnValue({ data: groupInboxData(), error: null, isLoading: false });
  });

  test("a group row links into the GROUP marking room and names its members", () => {
    const container = render();

    const link = byText(container, "The Pair", "a");
    expect(link.getAttribute("href")).toBe("/classes/c1/assignments/a1/marking/group/g1");
    expect(container.querySelector(".inbox-row__members").textContent).toBe("Alice, Bob");
  });

  test("an ungrouped student keeps their own row, linking to their own marking room", () => {
    const container = render();
    expect(byText(container, "Dee", "a").getAttribute("href")).toBe("/classes/c1/assignments/a1/marking/s4");
  });

  test("the progress line counts groups, not people — one hand-in per group", () => {
    const container = render();
    expect(container.textContent).toContain("1 of 3 submitted");
  });

  test("Remind's confirm counts the PEOPLE it will email, not the rows", async () => {
    const container = render();
    click(byText(container, "Remind"));
    await flush();

    // Two missing ROWS, but three people: The Solo's two members plus the
    // ungrouped student. The sentence promises emails, so it counts emails.
    expect(window.confirm).toHaveBeenCalledWith("Email 3 students who have not submitted?");
  });
});
