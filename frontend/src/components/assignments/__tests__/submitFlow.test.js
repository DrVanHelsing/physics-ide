import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import BriefPane from "../BriefPane";
import AssignmentPage from "../AssignmentPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { getGlobalSyncEngine } from "../../../utils/sync/syncEngine";
import { api } from "../../../utils/api/client";

/**
 * Task 14 — Submit. Exercises the click flow itself (push happens BEFORE
 * post, the success/refusal renders, and the late-phase warning's phase
 * gating) on both surfaces the button lives on: BriefPane's footer and
 * AssignmentPage. Each surface's own chrome (collapse, InstructionsView,
 * ClassChrome routing, the Start/Continue button) is already covered by
 * briefPane.test.js / assignmentPage.test.js — this suite stubs that down
 * to the minimum and focuses on Submit.
 *
 * engine + api are mocked directly (SyncChip.test.js's idiom) rather than
 * the real sync stack; startWork.js is deliberately left UNMOCKED so the
 * real `assertPushSucceeded` guard runs against the mocked engine's own
 * `getStatus()` — the same guard startWork.js's own start flow uses.
 */
vi.mock("../../../contexts/AssignmentContext", () => ({
  useAssignmentContext: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("../InstructionsView", () => ({ default: () => null }));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../../utils/sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

const { paramsHolder, navigateSpy } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", aid: "a1" },
  navigateSpy: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => paramsHolder,
  useNavigate: () => navigateSpy,
  Navigate: () => null,
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", myRole: "student" }, { id: "u1" }),
}));

const ME = { id: "u1" };

function engineWith(pushImpl) {
  return {
    pushProject: pushImpl,
    getStatus: () => ({ state: "idle" }),
  };
}

/** Flushes the microtask queue via a real macrotask boundary, same idiom as
 *  SyncChip.test.js / AssignmentContext.test.js, so the click handler's
 *  chain of awaits (engine, push, post) lands before the DOM is inspected. */
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

describe("Submit — BriefPane footer", () => {
  const CTX = { assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: null, rules: {} };

  function queryData({ myWork = { projectId: "p-1", startedAt: 1 }, phase = "open" } = {}) {
    return {
      data: { assignment: { instructions: null, myWork, phase } },
      error: null,
      isLoading: false,
    };
  }

  beforeEach(() => {
    // Nothing matches the collapse-floor query — the pane renders expanded
    // so the footer is reachable, same setup as briefPane.test.js.
    globalThis.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    window.sessionStorage.clear();
    useAssignmentContext.mockReturnValue(CTX);
    useQuery.mockReturnValue(queryData());
    useMe.mockReturnValue({ data: ME });
  });

  function render(overrides) {
    if (overrides) useQuery.mockReturnValue(queryData(overrides));
    mounted = mountComponent(<BriefPane />);
    return mounted.container;
  }

  test("no myWork -> no Submit button in the footer", () => {
    const container = render({ myWork: null });
    expect(byText(container, "Submit", "button")).toBeNull();
  });

  test("click order: pushProject runs BEFORE the submit POST", async () => {
    const calls = [];
    const pushProject = vi.fn(async (...args) => {
      calls.push(["push", ...args]);
    });
    getGlobalSyncEngine.mockResolvedValue(engineWith(pushProject));
    api.mockImplementation(async (url) => {
      calls.push(["post", url]);
      return { submission: { id: "s-1", fingerprint: "abcd1234ef56", late: false, attempt: 1, submittedAt: 1 } };
    });

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    expect(calls.map((c) => c[0])).toEqual(["push", "post"]);
    expect(pushProject).toHaveBeenCalledWith("p-1", "u1");
    expect(api).toHaveBeenCalledWith("/api/assignments/a-1/submit", { method: "POST" });
  });

  test("success renders an alert--success with role=status carrying the attempt and an 8-hex-char fingerprint", async () => {
    getGlobalSyncEngine.mockResolvedValue(engineWith(vi.fn().mockResolvedValue(undefined)));
    api.mockResolvedValue({
      submission: { id: "s-1", fingerprint: "abcd1234ef567890", late: false, attempt: 3, submittedAt: 1 },
    });

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    const alert = container.querySelector(".alert.alert--success[role='status']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Submitted — attempt 3. Fingerprint abcd1234.");
    expect(alert.querySelector("code").textContent).toBe("abcd1234");
  });

  test("refusal renders the server's sentence in an alert--danger", async () => {
    getGlobalSyncEngine.mockResolvedValue(engineWith(vi.fn().mockResolvedValue(undefined)));
    api.mockRejectedValue(new Error("This assignment is closed."));

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    const alert = container.querySelector(".alert.alert--danger[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("This assignment is closed.");
  });

  test("late_window: the warning line renders BEFORE the button; open: no warning", () => {
    const lateContainer = render({ phase: "late_window" });
    const html = lateContainer.querySelector(".brief-pane__footer").innerHTML;
    expect(html).toContain("The due date has passed — this submission will carry a permanent late label.");
    expect(html.indexOf("permanent late label")).toBeLessThan(html.indexOf(">Submit<"));

    mounted.unmount();
    const openContainer = render({ phase: "open" });
    expect(openContainer.textContent).not.toContain("permanent late label");
  });
});

describe("Submit — AssignmentPage", () => {
  function assignmentData(overrides = {}) {
    return {
      assignment: {
        id: "a1",
        classId: "c1",
        title: "Momentum Lab",
        projectType: "physics",
        phase: "open",
        dueAt: null,
        instructions: null,
        rules: {},
        myWork: { projectId: "p-1", startedAt: 1 },
        starterSeed: null,
        hasStarter: false,
        ...overrides,
      },
    };
  }

  beforeEach(() => {
    paramsHolder.id = "c1";
    paramsHolder.aid = "a1";
    useQuery.mockReturnValue({ data: assignmentData(), error: null, isLoading: false });
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

  function render(overrides) {
    if (overrides) useQuery.mockReturnValue({ data: assignmentData(overrides), error: null, isLoading: false });
    mounted = mountComponent(<AssignmentPage />);
    return mounted.container;
  }

  test("no myWork -> no Submit button", () => {
    const container = render({ myWork: null });
    expect(byText(container, "Submit", "button")).toBeNull();
  });

  test("click order: pushProject runs BEFORE the submit POST", async () => {
    const calls = [];
    const pushProject = vi.fn(async (...args) => {
      calls.push(["push", ...args]);
    });
    getGlobalSyncEngine.mockResolvedValue(engineWith(pushProject));
    api.mockImplementation(async (url) => {
      calls.push(["post", url]);
      return { submission: { id: "s-1", fingerprint: "abcd1234ef56", late: false, attempt: 1, submittedAt: 1 } };
    });

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    expect(calls.map((c) => c[0])).toEqual(["push", "post"]);
    expect(pushProject).toHaveBeenCalledWith("p-1", "u1");
    expect(api).toHaveBeenCalledWith("/api/assignments/a1/submit", { method: "POST" });
  });

  test("success renders an alert--success with role=status carrying the attempt and an 8-hex-char fingerprint", async () => {
    getGlobalSyncEngine.mockResolvedValue(engineWith(vi.fn().mockResolvedValue(undefined)));
    api.mockResolvedValue({
      submission: { id: "s-1", fingerprint: "deadbeef00112233", late: false, attempt: 2, submittedAt: 1 },
    });

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    const alert = container.querySelector(".alert.alert--success[role='status']");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Submitted — attempt 2. Fingerprint deadbeef.");
  });

  test("refusal renders the server's sentence in an alert--danger, distinct from the Start button's own error alert", async () => {
    getGlobalSyncEngine.mockResolvedValue(engineWith(vi.fn().mockResolvedValue(undefined)));
    api.mockRejectedValue(new Error("The due date has passed."));

    const container = render();
    click(byText(container, "Submit", "button"));
    await flush();

    const alerts = container.querySelectorAll(".alert.alert--danger[role='alert']");
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toBe("The due date has passed.");
  });

  test("late_window: the warning line renders BEFORE the Submit button; open: no warning", () => {
    const lateContainer = render({ phase: "late_window" });
    const html = lateContainer.innerHTML;
    expect(html).toContain("The due date has passed — this submission will carry a permanent late label.");
    expect(html.indexOf("permanent late label")).toBeLessThan(html.indexOf(">Submit<"));

    mounted.unmount();
    const openContainer = render({ phase: "open" });
    expect(openContainer.textContent).not.toContain("permanent late label");
  });

  test("closed: no Submit button even though myWork exists (never promises what the server will refuse)", () => {
    const container = render({ phase: "closed" });
    expect(byText(container, "Submit", "button")).toBeNull();
  });
});
