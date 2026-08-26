import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import GuidesTab from "../GuidesTab";
import GuidePage from "../GuidePage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { api } from "../../../utils/api/client";

/* Same idiom as assignmentsTab.test.js / assignmentEditor.test.js: stub
   react-query's hooks and useMe() directly rather than mounting a real
   QueryClientProvider, and mock react-router-dom's params/navigate. */
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

const { paramsHolder, navigateSpy } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", gid: undefined },
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
   Stand it up as a <textarea>, same stand-in as assignmentEditor.test.js. */
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

/* GuidesTab mounts ClassChrome (mocked below) — same shell stub
   assignmentsTab.test.js uses, with myRole flipping per test via this
   mutable holder. */
const { roleHolder } = vi.hoisted(() => ({ roleHolder: { myRole: "teacher" } }));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", myRole: roleHolder.myRole }, { id: "u1" }),
}));

function typeInput(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

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
  roleHolder.myRole = "teacher";
  paramsHolder.id = "c1";
  paramsHolder.gid = undefined;
});

function renderTab() {
  mounted = mountComponent(<GuidesTab />);
  return mounted.container;
}

describe("GuidesTab", () => {
  test("teacher view: renders guide titles linking to the read page, and a New guide link", () => {
    roleHolder.myRole = "teacher";
    useQuery.mockReturnValue({
      data: {
        guides: [
          { id: "g1", title: "Lab Safety", publishedAt: 1700000000000 },
          { id: "g2", title: "Draft Notes", publishedAt: null },
        ],
      },
      error: null,
      isLoading: false,
    });

    const container = renderTab();
    expect(byText(container, "Lab Safety", "span")).not.toBeNull();
    expect(byText(container, "Draft Notes", "span")).not.toBeNull();

    const row = container.querySelector('a[href="/classes/c1/guides/g1"]');
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("Lab Safety");

    const link = byText(container, "New guide", "a");
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/classes/c1/guides/new");
  });

  test("unpublished guides show a badge--warning \"draft\" for staff; published guides show none", () => {
    roleHolder.myRole = "teacher";
    useQuery.mockReturnValue({
      data: {
        guides: [
          { id: "g1", title: "Lab Safety", publishedAt: 1700000000000 },
          { id: "g2", title: "Draft Notes", publishedAt: null },
        ],
      },
      error: null,
      isLoading: false,
    });

    const container = renderTab();
    const badges = [...container.querySelectorAll(".badge.badge--warning")];
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("draft");
  });

  test("student view: no New guide link, no draft badge", () => {
    roleHolder.myRole = "student";
    useQuery.mockReturnValue({
      data: { guides: [{ id: "g1", title: "Lab Safety", publishedAt: 1700000000000 }] },
      error: null,
      isLoading: false,
    });

    const container = renderTab();
    expect(byText(container, "New guide", "a")).toBeNull();
    expect(container.querySelector(".badge.badge--warning")).toBeNull();
  });

  test("teacher empty state", () => {
    roleHolder.myRole = "teacher";
    useQuery.mockReturnValue({ data: { guides: [] }, error: null, isLoading: false });
    const container = renderTab();
    const empty = container.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("No guides yet — create the first one.");
  });

  test("student empty state", () => {
    roleHolder.myRole = "student";
    useQuery.mockReturnValue({ data: { guides: [] }, error: null, isLoading: false });
    const container = renderTab();
    const empty = container.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("Nothing here yet. Your teacher's guides will appear here.");
  });
});

const CLASS_DATA = { class: { id: "c1", name: "Physics 101", myRole: "teacher" } };

function guideData(overrides = {}) {
  return {
    guide: {
      id: "g1",
      classId: "c1",
      title: "Lab Safety",
      publishedAt: null,
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Wear goggles." }] }],
      },
      ...overrides,
    },
  };
}

function defaultUseQuery({ queryKey }) {
  if (queryKey[0] === "class") return { data: CLASS_DATA, error: null, isLoading: false };
  if (queryKey[0] === "guide") return { data: undefined, error: null, isLoading: false };
  return { data: undefined, error: null, isLoading: false };
}

const invalidateQueries = vi.fn();

beforeEach(() => {
  paramsHolder.id = "c1";
  paramsHolder.gid = undefined;
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

async function renderPage(mode) {
  mounted = mountComponent(<GuidePage mode={mode} />);
  await flush();
  return mounted.container;
}

describe("GuidePage — read mode", () => {
  test("renders the title and the body through InstructionsView; teacher sees Edit/Publish and the draft badge", async () => {
    paramsHolder.gid = "g1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "guide") return { data: guideData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });

    const container = await renderPage("read");

    expect(container.textContent).toContain("Lab Safety");
    const rendered = container.querySelector(".instructions");
    expect(rendered).not.toBeNull();
    expect(rendered.querySelector("p").textContent).toBe("Wear goggles.");

    expect(byText(container, "Edit", "a")).not.toBeNull();
    expect(byText(container, "Publish")).not.toBeNull();

    const badge = container.querySelector(".badge.badge--warning");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("draft");
  });

  test("a published guide shows no Publish control and no draft badge", async () => {
    paramsHolder.gid = "g1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "guide") {
        return { data: guideData({ publishedAt: 1700000000000 }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });

    const container = await renderPage("read");
    expect(byText(container, "Publish")).toBeNull();
    expect(container.querySelector(".badge.badge--warning")).toBeNull();
    expect(byText(container, "Edit", "a")).not.toBeNull();
  });

  test("a student sees the body but no Edit/Publish/Delete controls", async () => {
    paramsHolder.gid = "g1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") {
        return { data: { class: { id: "c1", myRole: "student" } }, error: null, isLoading: false };
      }
      if (queryKey[0] === "guide") {
        return { data: guideData({ publishedAt: 1700000000000 }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });

    const container = await renderPage("read");
    expect(container.querySelector(".instructions").textContent).toContain("Wear goggles.");
    expect(byText(container, "Edit", "a")).toBeNull();
    expect(byText(container, "Publish")).toBeNull();
    expect(byText(container, "Delete")).toBeNull();
  });

  test("Publish posts to the publish route", async () => {
    paramsHolder.gid = "g1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "guide") return { data: guideData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await renderPage("read");

    click(byText(container, "Publish"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/guides/g1/publish", { method: "POST" });
  });

  test("Delete DELETEs the guide and navigates back to the guides list", async () => {
    paramsHolder.gid = "g1";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "guide") return { data: guideData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await renderPage("read");

    click(byText(container, "Delete"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/guides/g1", { method: "DELETE" });
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1/guides");
  });
});

describe("GuidePage — new/edit mode", () => {
  test("new mode: renders an empty form with a title input and the (stubbed) rich text editor", async () => {
    const container = await renderPage("edit");
    const title = container.querySelector('input[name="title"]');
    expect(title).not.toBeNull();
    expect(title.value).toBe("");
    expect(container.querySelector(".rte-stub")).not.toBeNull();
  });

  test("Save posts to the class guides route and navigates to the new guide's read page", async () => {
    api.mockResolvedValueOnce({ guide: { id: "g9" } });
    const container = await renderPage("edit");

    typeInput(container.querySelector('input[name="title"]'), "New Guide Title");
    click(byText(container, "Save"));
    await flush();

    expect(api).toHaveBeenCalledTimes(1);
    const [path, opts] = api.mock.calls[0];
    expect(path).toBe("/api/classes/c1/guides");
    expect(opts.method).toBe("POST");
    expect(opts.body.title).toBe("New Guide Title");
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1/guides/g9");
  });

  test("edit mode seeds the form from GET /api/guides/:gid and Save PATCHes", async () => {
    paramsHolder.gid = "g1";
    api.mockResolvedValueOnce({ guide: { id: "g1" } });
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "guide") return { data: guideData(), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = await renderPage("edit");

    expect(container.querySelector('input[name="title"]').value).toBe("Lab Safety");

    click(byText(container, "Save"));
    await flush();

    const [path, opts] = api.mock.calls[0];
    expect(path).toBe("/api/guides/g1");
    expect(opts.method).toBe("PATCH");
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1/guides/g1");
  });

  test("a non-teacher role sees the Teachers-only alert instead of the form", async () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") {
        return { data: { class: { id: "c1", myRole: "student" } }, error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });

    const container = await renderPage("edit");
    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Teachers only for this class.");
    expect(container.querySelector('input[name="title"]')).toBeNull();
  });
});
