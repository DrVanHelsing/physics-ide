import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import AssignmentEditorPage from "../AssignmentEditorPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { api } from "../../../utils/api/client";
import { ASSIGNMENT_PROJECT_TYPES, BUILT_IN_RULE_SETS, SUBMISSION_MODES } from "@physics-ide/shared";

/* Same idiom as adminTabs.test.js / assignmentsTab.test.js: stub react-query's
   three hooks and useMe() directly rather than mounting a real
   QueryClientProvider. useMutation's stub actually drives the mutationFn
   (through the mocked `api`) so Save's POST/PATCH body and success/error
   paths are real, not hand-waved. RulesPicker (mounted for real, not
   mocked — its own suite is rulesPicker.test.js) also calls useQuery/
   useMutation/useQueryClient, so the same three stubs cover it. */
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

const { paramsHolder, navigateSpy } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", aid: undefined },
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

/* The TipTap editor itself is NOT mounted in jsdom — it is lazy and heavy.
   Stand it up as a <textarea> that emits a minimal doc on change, per the
   brief. */
vi.mock("../RichTextEditor", () => ({
  default: ({ value, onChange }) => (
    <textarea
      className="rte-stub"
      value={value?.content?.[0]?.content?.[0]?.text ?? ""}
      onChange={(e) =>
        onChange({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: e.target.value }] }],
        })
      }
    />
  ),
}));

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function typeInput(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function selectValue(select, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const CLASS_DATA = { class: { id: "c1", name: "Physics 101", myRole: "teacher" } };

/** A draft assignment payload, overridable per test — used by the starter-row
 *  and lifecycle-controls suites below. */
function assignmentData(overrides = {}) {
  return {
    assignment: {
      id: "a1",
      classId: "c1",
      title: "Momentum Lab",
      projectType: "physics",
      points: null,
      submissionMode: "individual",
      individualWork: false,
      phase: "draft",
      opensAt: null,
      dueAt: null,
      lateUntil: null,
      hasStarter: false,
      instructions: { type: "doc", content: [] },
      rules: BUILT_IN_RULE_SETS.standard_classwork,
      myWork: null,
      ...overrides,
    },
  };
}

function defaultUseQuery({ queryKey }) {
  if (queryKey[0] === "class") return { data: CLASS_DATA, error: null, isLoading: false };
  if (queryKey[0] === "assignment") return { data: undefined, error: null, isLoading: false };
  if (queryKey[0] === "rule-sets") return { data: { ruleSets: [] }, error: null, isLoading: false };
  if (queryKey[0] === "projects") return { data: { projects: [] }, error: null, isLoading: false };
  return { data: undefined, error: null, isLoading: false };
}

const invalidateQueries = vi.fn();

let mounted = null;

beforeEach(() => {
  paramsHolder.id = "c1";
  paramsHolder.aid = undefined;
  useQuery.mockImplementation(defaultUseQuery);
  useMe.mockReturnValue({ data: { id: "u1", name: "Teacher" }, isLoading: false });
  useQueryClient.mockReturnValue({ invalidateQueries });
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

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

async function render() {
  mounted = mountComponent(<AssignmentEditorPage />);
  await flush();
  return mounted.container;
}

describe("AssignmentEditorPage — new mode", () => {
  test("renders the settings form: title, goal, points, submission mode, individual-work, and the three date inputs", async () => {
    const container = await render();

    const title = container.querySelector('input[name="title"]');
    expect(title).not.toBeNull();
    expect(title.value).toBe("");

    const projectType = container.querySelector('select[name="projectType"]');
    expect(projectType).not.toBeNull();
    expect([...projectType.options].map((o) => o.value)).toEqual([...ASSIGNMENT_PROJECT_TYPES]);

    const points = container.querySelector('input[name="points"]');
    expect(points).not.toBeNull();
    expect(points.type).toBe("number");
    expect(points.value).toBe("");
    expect(points.getAttribute("placeholder")).toBe("Complete/not-complete");

    const submissionMode = container.querySelector('select[name="submissionMode"]');
    expect(submissionMode).not.toBeNull();
    expect([...submissionMode.options].map((o) => o.value)).toEqual([...SUBMISSION_MODES]);
    expect(submissionMode.value).toBe("individual");

    const individualWork = container.querySelector('input[name="individualWork"]');
    expect(individualWork).not.toBeNull();
    expect(individualWork.type).toBe("checkbox");
    expect(individualWork.checked).toBe(false);
    expect(individualWork.disabled).toBe(false); // default mode is "individual"

    // Task 6: the honest label — sharing does not exist anywhere yet, so
    // "can't be shared" is simply true today (brief's honesty note).
    expect(
      byText(
        container,
        "Individual work — students see the stamp, and this work can't be shared with classmates",
        "label",
      ),
    ).not.toBeNull();

    expect(container.querySelector('input[name="opensAt"][type="datetime-local"]')).not.toBeNull();
    expect(container.querySelector('input[name="dueAt"][type="datetime-local"]')).not.toBeNull();
    expect(container.querySelector('input[name="lateUntil"][type="datetime-local"]')).not.toBeNull();
  });

  test("a non-teacher role sees the Teachers-only alert instead of the form", async () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") {
        return { data: { class: { id: "c1", myRole: "student" } }, error: null, isLoading: false };
      }
      return { data: undefined, error: null, isLoading: false };
    });

    const container = await render();
    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Teachers only for this class.");
    expect(container.querySelector('input[name="title"]')).toBeNull();
  });
});

describe("AssignmentEditorPage — save", () => {
  test("Save posts to the class assignments route with epoch-ms dates and navigates to the class page", async () => {
    api.mockResolvedValueOnce({ assignment: { id: "a1" } });
    const container = await render();

    typeInput(container.querySelector('input[name="title"]'), "Kinematics HW");
    typeInput(container.querySelector('input[name="dueAt"]'), "2026-09-10T09:00");

    click(byText(container, "Save"));
    await flush();

    expect(api).toHaveBeenCalledTimes(1);
    const [path, opts] = api.mock.calls[0];
    expect(path).toBe("/api/classes/c1/assignments");
    expect(opts.method).toBe("POST");
    expect(opts.body.title).toBe("Kinematics HW");
    expect(opts.body.dueAt).toBe(new Date("2026-09-10T09:00").getTime());
    expect(opts.body.opensAt).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1");
  });

  test("a server 400 renders an alert alert--danger with the message, and does not navigate", async () => {
    // A non-empty title clears the input's own `required` constraint so the
    // submit actually reaches the mutation — this exercises the server's
    // rejection, not the browser's built-in validation.
    api.mockRejectedValueOnce(new Error("The due date must come after the open date."));
    const container = await render();
    typeInput(container.querySelector('input[name="title"]'), "Kinematics HW");

    click(byText(container, "Save"));
    await flush();

    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("The due date must come after the open date.");
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe("AssignmentEditorPage — edit mode", () => {
  test("seeds fields from GET /api/assignments/:aid", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") return { data: CLASS_DATA, error: null, isLoading: false };
      if (queryKey[0] === "assignment") {
        return {
          data: {
            assignment: {
              id: "a1",
              classId: "c1",
              title: "Momentum Lab",
              projectType: "hybrid",
              points: 20,
              submissionMode: "pair",
              individualWork: false,
              opensAt: null,
              dueAt: new Date("2026-09-10T09:00").getTime(),
              lateUntil: null,
              instructions: { type: "doc", content: [] },
            },
          },
          error: null,
          isLoading: false,
        };
      }
      return { data: undefined, error: null, isLoading: false };
    });

    const container = await render();

    expect(container.querySelector('input[name="title"]').value).toBe("Momentum Lab");
    expect(container.querySelector('select[name="projectType"]').value).toBe("hybrid");
    expect(container.querySelector('input[name="points"]').value).toBe("20");
    expect(container.querySelector('select[name="submissionMode"]').value).toBe("pair");
    expect(container.querySelector('input[name="opensAt"]').value).toBe("");
    expect(container.querySelector('input[name="dueAt"]').value).toBe("2026-09-10T09:00");
    expect(container.querySelector('input[name="lateUntil"]').value).toBe("");

    // PATCH, not POST, and against the assignment route.
    click(byText(container, "Save"));
    await flush();
    const [path, opts] = api.mock.calls[0];
    expect(path).toBe("/api/assignments/a1");
    expect(opts.method).toBe("PATCH");
  });
});

describe("AssignmentEditorPage — individual work coupling", () => {
  test("checking individualWork then switching mode away from individual clears and disables it", async () => {
    const container = await render();
    const checkbox = container.querySelector('input[name="individualWork"]');
    const mode = container.querySelector('select[name="submissionMode"]');

    expect(checkbox.disabled).toBe(false);
    click(checkbox);
    expect(checkbox.checked).toBe(true);

    selectValue(mode, "group");

    const checkboxAfter = container.querySelector('input[name="individualWork"]');
    expect(checkboxAfter.checked).toBe(false);
    expect(checkboxAfter.disabled).toBe(true);
  });
});

describe("AssignmentEditorPage — date round-trip", () => {
  test("a filled datetime-local becomes epoch ms in the payload; an empty one posts null", async () => {
    api.mockResolvedValueOnce({ assignment: { id: "a1" } });
    const container = await render();

    typeInput(container.querySelector('input[name="title"]'), "Round Trip");
    typeInput(container.querySelector('input[name="opensAt"]'), "2026-09-01T08:00");
    // dueAt and lateUntil left empty.

    click(byText(container, "Save"));
    await flush();

    const [, opts] = api.mock.calls[0];
    expect(opts.body.opensAt).toBe(new Date("2026-09-01T08:00").getTime());
    expect(opts.body.dueAt).toBeNull();
    expect(opts.body.lateUntil).toBeNull();
  });
});

describe("AssignmentEditorPage — workspace rules", () => {
  test("a new assignment defaults its rules to Standard classwork and Save includes them", async () => {
    api.mockResolvedValueOnce({ assignment: { id: "a1" } });
    const container = await render();

    const standardRadio = [...container.querySelectorAll("label")].find(
      (l) => l.textContent.trim() === "Standard classwork",
    )?.querySelector("input[type=radio]");
    expect(standardRadio).not.toBeNull();
    expect(standardRadio.checked).toBe(true);

    typeInput(container.querySelector('input[name="title"]'), "Kinematics HW");
    click(byText(container, "Save"));
    await flush();

    const [, opts] = api.mock.calls[0];
    expect(opts.body.rules).toEqual(BUILT_IN_RULE_SETS.standard_classwork);
  });

  test("edit mode seeds the picker from the assignment's saved rules; picking a different preset changes the PATCH payload", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return {
          data: assignmentData({ rules: BUILT_IN_RULE_SETS.open_practice }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    const openRadio = [...container.querySelectorAll("label")].find(
      (l) => l.textContent.trim() === "Open practice",
    )?.querySelector("input[type=radio]");
    expect(openRadio.checked).toBe(true);

    const lockedRadio = [...container.querySelectorAll("label")].find(
      (l) => l.textContent.trim() === "Locked assessment",
    )?.querySelector("input[type=radio]");
    click(lockedRadio);

    click(byText(container, "Save"));
    await flush();

    const [, opts] = api.mock.calls[0];
    expect(opts.body.rules).toEqual(BUILT_IN_RULE_SETS.locked_assessment);
  });
});

describe("AssignmentEditorPage — starter project", () => {
  test("new mode renders no starter row — an assignment must exist first", async () => {
    const container = await render();
    expect(container.querySelector('select[name="starterProjectId"]')).toBeNull();
  });

  test("edit mode lists the teacher's own non-deleted projects; Pin posts the chosen projectId", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") return { data: assignmentData(), error: null, isLoading: false };
      if (queryKey[0] === "projects") {
        return {
          data: {
            projects: [
              { id: "p-1", title: "Pendulum starter", goal: "physics", projectType: "physics", clientUpdatedAt: 1, deleted: false },
              { id: "p-2", title: "Trashed one", goal: "physics", projectType: "physics", clientUpdatedAt: 1, deleted: true },
            ],
          },
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    const select = container.querySelector('select[name="starterProjectId"]');
    expect(select).not.toBeNull();
    const optionValues = [...select.options].map((o) => o.value).filter(Boolean);
    expect(optionValues).toEqual(["p-1"]); // the deleted project is not offered

    selectValue(select, "p-1");
    click(byText(container, "Pin"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/starter", {
      method: "POST",
      body: { projectId: "p-1" },
    });
  });

  test("hasStarter renders a Clear control that DELETEs the pinned starter", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return { data: assignmentData({ hasStarter: true }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    const clearBtn = byText(container, "Clear");
    expect(clearBtn).not.toBeNull();
    click(clearBtn);
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/starter", { method: "DELETE" });
  });
});

describe("AssignmentEditorPage — lifecycle controls", () => {
  test("a draft shows Publish with the immediate-visibility sentence and Delete draft, never Close now", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") return { data: assignmentData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    expect(byText(container, "Publish")).not.toBeNull();
    expect(byText(container, "Delete draft")).not.toBeNull();
    expect(byText(container, "Close now")).toBeNull();
    expect(container.textContent).toContain("Students in this class will see it immediately.");

    const publishBtn = byText(container, "Publish");
    expect(publishBtn.classList.contains("btn--primary")).toBe(true);
    const deleteBtn = byText(container, "Delete draft");
    expect(deleteBtn.classList.contains("btn--danger")).toBe(true);
    expect(deleteBtn.classList.contains("btn--primary")).toBe(false);
  });

  test("a draft scheduled to open later names the open date instead of 'immediately'", async () => {
    paramsHolder.aid = "a1";
    const opensAt = new Date("2026-09-01T08:00").getTime();
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return { data: assignmentData({ opensAt }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    expect(container.textContent).not.toContain("Students in this class will see it immediately.");
    expect(container.textContent).toContain("Students in this class will see it");
  });

  test("a live unsaved Opens edit cannot make the sentence promise a schedule Publish won't honor", async () => {
    // Fix round (review of 9c831c0): Publish POSTs no body — it acts on
    // whatever is already persisted. Seed a persisted assignment (opensAt
    // null → immediate), then edit the Opens field WITHOUT saving.
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return { data: assignmentData({ opensAt: null }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    expect(container.textContent).toContain("Students in this class will see it immediately.");
    expect(byText(container, "Publish").disabled).toBe(false);

    typeInput(container.querySelector('input[name="opensAt"]'), "2026-09-01T08:00");

    // The live edit never reached the server, so the sentence must keep
    // describing the PERSISTED state — never a schedule Publish (no-body
    // POST) won't actually honor.
    expect(container.textContent).toContain("Students in this class will see it immediately.");
    expect(container.textContent).not.toContain("starting");

    // Publish is gated off while the dates are dirty, with an inline hint.
    expect(byText(container, "Publish").disabled).toBe(true);
    expect(container.textContent).toContain(
      "Save your changes first — unsaved date edits do not apply.",
    );
  });

  test("a published (non-draft) assignment shows Close now only", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return { data: assignmentData({ phase: "open" }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    expect(byText(container, "Close now")).not.toBeNull();
    expect(byText(container, "Publish")).toBeNull();
    expect(byText(container, "Delete draft")).toBeNull();
    const closeBtn = byText(container, "Close now");
    expect(closeBtn.classList.contains("btn--danger")).toBe(true);
    expect(closeBtn.classList.contains("btn--primary")).toBe(false);
  });

  test("Publish posts to the publish route", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") return { data: assignmentData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    click(byText(container, "Publish"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/publish", { method: "POST" });
  });

  test("Close now posts to the close route", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") {
        return { data: assignmentData({ phase: "open" }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    click(byText(container, "Close now"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/close", { method: "POST" });
  });

  test("Delete draft DELETEs the assignment and navigates back to the class page", async () => {
    paramsHolder.aid = "a1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignment") return { data: assignmentData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await render();

    click(byText(container, "Delete draft"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1", { method: "DELETE" });
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1");
  });
});
