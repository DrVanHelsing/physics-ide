import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import BatonChip from "../BatonChip";
import { mountComponent, byText } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";
import { useMe } from "../../../auth/useAuth";
import { api } from "../../../utils/api/client";

/* BatonChip calls useAssignmentContext(), useMe() and api() directly —
   stub all three, the same way RulesChip.test.js stubs the first for the
   same shape of hook. */
vi.mock("../../../contexts/AssignmentContext", () => ({ useAssignmentContext: vi.fn() }));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));

const ME = { id: "u-me", name: "Ada" };

function ctx(groupId) {
  return {
    assignmentId: "a-1",
    classId: "c-1",
    title: "Momentum Lab",
    dueAt: null,
    rules: null,
    groupId,
  };
}

const LIVE = 60 * 1000;

function baton({ holderId, holderName, ms }) {
  return { holderId, holderName, expiresAt: holderId ? Date.now() + ms : null };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let mounted = null;

beforeEach(() => {
  useMe.mockReturnValue({ data: ME });
  useAssignmentContext.mockReturnValue(ctx("g-1"));
  api.mockReset();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function render(onBaton = vi.fn()) {
  mounted = mountComponent(<BatonChip onBaton={onBaton} />);
  await flush();
  return { container: mounted.container, onBaton };
}

function chipText(container) {
  return container.querySelector(".baton-chip__text")?.textContent ?? null;
}

describe("BatonChip — no group", () => {
  test("outside group work the chip renders nothing and never polls", async () => {
    useAssignmentContext.mockReturnValue(ctx(null));
    const { container } = await render();
    expect(container.querySelector(".baton-chip")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  test("no assignment context at all (a free project) renders nothing", async () => {
    useAssignmentContext.mockReturnValue(null);
    const { container } = await render();
    expect(container.querySelector(".baton-chip")).toBeNull();
  });
});

describe("BatonChip — the three states (spec §5.5)", () => {
  test("holder: 'Editing — baton yours', no Take over button, and the baton is reported held", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    const { container, onBaton } = await render();

    expect(chipText(container)).toBe("Editing — baton yours");
    expect(byText(container, "Take over")).toBeNull();
    expect(onBaton).toHaveBeenCalledWith({ groupId: "g-1", held: true });
  });

  test("someone else holds a LIVE lease: read-only, named, and no Take over button", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: LIVE }) });
    const { container, onBaton } = await render();

    expect(chipText(container)).toBe("Read-only — Thabo is editing");
    expect(byText(container, "Take over")).toBeNull();
    expect(onBaton).toHaveBeenCalledWith({ groupId: "g-1", held: false });
  });

  test("their lease has EXPIRED: still named (you take over from them), and the button appears", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container } = await render();

    expect(chipText(container)).toBe("Read-only — Thabo is editing");
    expect(byText(container, "Take over")).not.toBeNull();
  });

  test("nobody has ever taken it: an honest sentence, not a name that isn't there, plus the button", async () => {
    api.mockResolvedValue({ baton: { holderId: null, holderName: null, expiresAt: null } });
    const { container } = await render();

    expect(chipText(container)).toBe("Read-only — nobody has the baton");
    expect(byText(container, "Take over")).not.toBeNull();
  });

  test("your OWN lease expired: never 'Ada is editing' told to Ada — the baton is free and says so", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: -1000 }) });
    const { container, onBaton } = await render();

    expect(chipText(container)).toBe("Read-only — nobody has the baton");
    expect(byText(container, "Take over")).not.toBeNull();
    expect(onBaton).toHaveBeenCalledWith({ groupId: "g-1", held: false });
  });
});

describe("BatonChip — taking over", () => {
  test("Take over POSTs the take route and the chip flips to yours", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container } = await render();

    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(api).toHaveBeenCalledWith("/api/groups/g-1/baton/take", { method: "POST" });
    expect(chipText(container)).toBe("Editing — baton yours");
  });

  test("someone got there first: the refusal re-reads the baton so the chip names who actually has it", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container } = await render();

    api.mockRejectedValueOnce(new Error("Another member holds the baton."));
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-3", holderName: "Naledi", ms: LIVE }) });
    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(chipText(container)).toBe("Read-only — Naledi is editing");
    expect(byText(container, "Take over")).toBeNull();
  });
});

describe("BatonChip — the polled lease (stack §sync)", () => {
  test("re-reads GET /baton every 20 seconds while a group context is open", async () => {
    api.mockResolvedValue({ baton: { holderId: null, holderName: null, expiresAt: null } });
    vi.useFakeTimers();
    mounted = mountComponent(<BatonChip onBaton={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/api/groups/g-1/baton");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(api).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(api).toHaveBeenCalledTimes(3);
  });

  test("the poll stops when the chip unmounts", async () => {
    api.mockResolvedValue({ baton: { holderId: null, holderName: null, expiresAt: null } });
    vi.useFakeTimers();
    mounted = mountComponent(<BatonChip onBaton={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    mounted.unmount();
    mounted = null;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(api).toHaveBeenCalledTimes(1);
  });

  test("an unreachable server leaves the last known state standing rather than inventing one", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: LIVE }) });
    vi.useFakeTimers();
    mounted = mountComponent(<BatonChip onBaton={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(chipText(mounted.container)).toBe("Read-only — Thabo is editing");

    api.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(chipText(mounted.container)).toBe("Read-only — Thabo is editing");
  });
});

describe("BatonChip — accessibility and shape", () => {
  test("the chip is a polite status region carrying the full sentence on title", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: LIVE }) });
    const { container } = await render();
    const chip = container.querySelector(".baton-chip");

    expect(chip.getAttribute("role")).toBe("status");
    expect(chip.getAttribute("aria-live")).toBe("polite");
    expect(chip.getAttribute("title")).toBe("Read-only — Thabo is editing");
  });

  test("Take over is a small primitive button, not a bespoke control", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container } = await render();

    expect(byText(container, "Take over").className).toBe("btn btn--sm");
  });
});
