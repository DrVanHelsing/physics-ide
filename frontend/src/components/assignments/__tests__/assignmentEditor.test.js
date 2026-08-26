import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import AssignmentEditorPage from "../AssignmentEditorPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { api } from "../../../utils/api/client";
import { ASSIGNMENT_PROJECT_TYPES, SUBMISSION_MODES } from "@physics-ide/shared";

/* Same idiom as adminTabs.test.js / assignmentsTab.test.js: stub react-query's
   three hooks and useMe() directly rather than mounting a real
   QueryClientProvider. useMutation's stub actually drives the mutationFn
   (through the mocked `api`) so Save's POST/PATCH body and success/error
   paths are real, not hand-waved. */
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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

function defaultUseQuery({ queryKey }) {
  if (queryKey[0] === "class") return { data: CLASS_DATA, error: null, isLoading: false };
  if (queryKey[0] === "assignment") return { data: undefined, error: null, isLoading: false };
  return { data: undefined, error: null, isLoading: false };
}

let mounted = null;

beforeEach(() => {
  paramsHolder.id = "c1";
  paramsHolder.aid = undefined;
  useQuery.mockImplementation(defaultUseQuery);
  useMe.mockReturnValue({ data: { id: "u1", name: "Teacher" }, isLoading: false });
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
