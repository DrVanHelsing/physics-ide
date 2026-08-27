import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import HistoryTimeline, { buildTimelineEntries, reasonLabel } from "../HistoryTimeline";
import HistoryPage from "../HistoryPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { getGlobalSyncEngine } from "../../../utils/sync/syncEngine";
import { api } from "../../../utils/api/client";

/**
 * Task 20 — History. Two things live here:
 *   - HistoryTimeline itself: the ONE renderer both feeders share (Plan 4's
 *     deferral) — plain-word reasons (D§6), and the student-shaped vs.
 *     teacher-shaped entry lists rendering through the same component.
 *   - HistoryPage: the student's own feeder — /history/:projectId. Same
 *     mocking idiom submitFlow.test.js / guides.test.js use: react-query's
 *     hooks and useMe() stubbed directly, react-router-dom mocked (Toolbar
 *     and every other useNavigate()-calling page in this codebase does the
 *     same), and useMutation's fake implementation actually RUNS the real
 *     mutationFn/onSuccess/onError the component passed in, so Restore's
 *     wiring (route, then engine.reconcile, then navigate home) is real
 *     coverage, not a mocked-away no-op.
 */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
// HistoryPage renders PortalHeader -> the real HeaderAccount, which calls
// useSignout()/useNavigate() too — same stub-it-out idiom guides.test.js /
// assignmentPage.test.js use, since only useMe is mocked above.
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../../utils/sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

const { paramsHolder, navigateSpy, redirectSpy } = vi.hoisted(() => ({
  paramsHolder: { projectId: "p-1" },
  navigateSpy: vi.fn(),
  redirectSpy: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => paramsHolder,
  useNavigate: () => navigateSpy,
  Navigate: (props) => {
    redirectSpy(props.to);
    return null;
  },
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

/** Flushes the microtask queue past the click handler's chain of awaits —
 *  same idiom submitFlow.test.js uses for the identical push-then-post shape. */
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

describe("HistoryTimeline — reason words (D§6)", () => {
  test("maps every machine reason to its plain word", () => {
    expect(reasonLabel("overwrite")).toBe("saved over");
    expect(reasonLabel("conflict-loser")).toBe("kept from a sync conflict");
    expect(reasonLabel("restore")).toBe("restored");
  });

  test("an unknown reason falls back to itself rather than throwing", () => {
    expect(reasonLabel("mystery")).toBe("mystery");
  });
});

describe("HistoryTimeline — empty state", () => {
  test("no entries renders the empty message, no list", () => {
    mounted = mountComponent(<HistoryTimeline entries={[]} onRestore={null} />);
    expect(mounted.container.querySelector(".history-timeline")).toBeNull();
    expect(mounted.container.querySelector(".empty").textContent).toBe("No checkpoints yet.");
  });
});

describe("HistoryTimeline — one component, two feeders", () => {
  test("student feeder: checkpoints only, plain-word reasons, newest first, Restore wired per row", () => {
    const entries = buildTimelineEntries({
      versions: [
        { versionId: 1, clientUpdatedAt: 1000, reason: "overwrite", savedAt: 2000 },
        { versionId: 2, clientUpdatedAt: 3000, reason: "restore", savedAt: 4000 },
      ],
    });
    const onRestore = vi.fn();
    mounted = mountComponent(<HistoryTimeline entries={entries} onRestore={onRestore} />);
    const rows = [...mounted.container.querySelectorAll(".history-checkpoint")];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("restored");
    expect(rows[1].textContent).toContain("saved over");

    // No attribution, no submission markers on the student's own feed.
    expect(mounted.container.querySelector(".history-checkpoint__by")).toBeNull();
    expect(mounted.container.textContent).not.toContain("Submitted");

    const restoreButtons = [...mounted.container.querySelectorAll(".history-checkpoint button")];
    expect(restoreButtons).toHaveLength(2);
    click(restoreButtons[0]);
    expect(onRestore).toHaveBeenCalledWith(2); // the newest row (savedAt 4000) is versionId 2
  });

  test("teacher feeder: savedBy attribution + a submission marker interleaved by time, no Restore buttons", () => {
    const entries = buildTimelineEntries({
      versions: [{ versionId: 10, clientUpdatedAt: 1000, reason: "overwrite", savedAt: 1000 }],
      submissions: [{ id: "s-1", attempt: 1, late: true, createdAt: 2000 }],
      savedByLabel: "Jamie Kid",
    });
    mounted = mountComponent(<HistoryTimeline entries={entries} onRestore={null} />);
    const rows = [...mounted.container.querySelectorAll(".history-checkpoint")];
    expect(rows).toHaveLength(2);
    // The submission marker (createdAt 2000) is newer than the checkpoint
    // (savedAt 1000) — interleaved by time, submission first.
    expect(rows[0].textContent).toContain("Submitted — attempt 1");
    expect(rows[0].querySelector(".badge--warning").textContent).toBe("late");
    expect(rows[1].textContent).toContain("saved over");
    expect(rows[1].querySelector(".history-checkpoint__by").textContent).toBe(" — Jamie Kid");

    expect(mounted.container.querySelectorAll(".history-checkpoint button")).toHaveLength(0);
  });
});

describe("buildTimelineEntries", () => {
  test("merges and sorts newest-first, accepting ISO strings and epoch numbers alike", () => {
    const entries = buildTimelineEntries({
      versions: [{ versionId: 1, reason: "overwrite", savedAt: "2024-01-01T00:00:00.000Z" }],
      submissions: [{ id: "s1", attempt: 1, late: false, createdAt: "2024-06-01T00:00:00.000Z" }],
    });
    expect(entries.map((e) => e.type)).toEqual(["submission", "checkpoint"]);
  });

  test("no savedByLabel -> checkpoints carry no attribution (the student's own feed)", () => {
    const entries = buildTimelineEntries({
      versions: [{ versionId: 1, reason: "overwrite", savedAt: 1000 }],
    });
    expect(entries[0].savedBy).toBeNull();
  });
});

describe("HistoryPage", () => {
  const ME = { id: "u1" };

  beforeEach(() => {
    paramsHolder.projectId = "p-1";
    useMe.mockReturnValue({ data: ME, isLoading: false });
    useQuery.mockReturnValue({
      data: { versions: [{ versionId: 1, clientUpdatedAt: 1000, reason: "overwrite", savedAt: 1000 }] },
      error: null,
      isLoading: false,
    });
    useMutation.mockImplementation((opts) => ({
      mutate: (vars) => {
        Promise.resolve()
          .then(() => opts.mutationFn(vars))
          .then((data) => opts.onSuccess && opts.onSuccess(data, vars))
          .catch((err) => opts.onError && opts.onError(err));
      },
      isPending: false,
    }));
  });

  function render() {
    mounted = mountComponent(<HistoryPage />);
    return mounted.container;
  }

  test("not signed in -> redirects to /auth/signin", () => {
    useMe.mockReturnValue({ data: null, isLoading: false });
    render();
    expect(redirectSpy).toHaveBeenCalledWith("/auth/signin");
  });

  test("renders the checkpoint list from GET /api/projects/:id/versions", () => {
    const container = render();
    expect(container.querySelector(".history-checkpoint")).not.toBeNull();
    expect(container.textContent).toContain("saved over");
  });

  test("Restore: calls the restore route, then reconciles the sync engine, then navigates home — in that order", async () => {
    const calls = [];
    api.mockImplementation(async (url, opts) => {
      calls.push(["api", url, opts?.method]);
      return { ok: true, clientUpdatedAt: 999 };
    });
    const reconcile = vi.fn(async (ownerId) => {
      calls.push(["reconcile", ownerId]);
    });
    getGlobalSyncEngine.mockResolvedValue({ reconcile });

    const container = render();
    click(container.querySelector(".history-checkpoint button"));
    await flush();

    expect(calls).toEqual([
      ["api", "/api/projects/p-1/versions/1/restore", "POST"],
      ["reconcile", "u1"],
    ]);
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  test("a restore failure shows the server's sentence instead of navigating", async () => {
    api.mockRejectedValue(new Error("No such version."));

    const container = render();
    click(container.querySelector(".history-checkpoint button"));
    await flush();

    const alert = container.querySelector(".alert.alert--danger[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("No such version.");
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test("Back to the IDE links home", () => {
    const container = render();
    const link = byText(container, "Back to the IDE", "a");
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/");
  });
});
