import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import BatonChip from "../BatonChip";
import { mountComponent, byText } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";
import { useMe } from "../../../auth/useAuth";
import { api } from "../../../utils/api/client";
import { pullGroupProject, onGroupPushFailed } from "../../../utils/assignments/groupSync";

/* BatonChip calls useAssignmentContext(), useMe() and api() directly —
   stub all three, the same way RulesChip.test.js stubs the first for the
   same shape of hook. groupSync is stubbed too (fix round 1): the chip now
   fetches the group's head on the way into holding it, and announces itself
   to the push-failure channel — what matters here is that it calls them, at
   the right moment; groupSync.test.js owns what they then do. */
vi.mock("../../../contexts/AssignmentContext", () => ({ useAssignmentContext: vi.fn() }));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("../../../utils/assignments/groupSync", () => ({
  pullGroupProject: vi.fn(),
  onGroupPushFailed: vi.fn(),
}));

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

/** The chip's push-failure subscription, captured so a test can fire it. */
let pushFailed = null;

beforeEach(() => {
  useMe.mockReturnValue({ data: ME });
  useAssignmentContext.mockReturnValue(ctx("g-1"));
  api.mockReset();
  pullGroupProject.mockReset();
  pullGroupProject.mockResolvedValue(null);
  pushFailed = null;
  onGroupPushFailed.mockReset();
  onGroupPushFailed.mockImplementation((fn) => {
    pushFailed = fn;
    return () => {
      pushFailed = null;
    };
  });
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

describe("BatonChip — before the baton has ever been read (fix round 1)", () => {
  test("the first poll still in flight: the chip says it is checking, offers no button, and reports no baton", async () => {
    api.mockImplementation(() => new Promise(() => {})); // never settles
    const { container, onBaton } = await render();

    expect(chipText(container)).toBe("Checking who's editing…");
    expect(byText(container, "Take over")).toBeNull();
    expect(onBaton).toHaveBeenCalledWith({ groupId: "g-1", held: null });
    expect(onBaton).not.toHaveBeenCalledWith({ groupId: "g-1", held: true });
  });

  test("a poll that has NEVER succeeded keeps saying so — it never claims a baton nobody confirmed", async () => {
    api.mockRejectedValue(new Error("offline"));
    const { container, onBaton } = await render();

    expect(chipText(container)).toBe("Checking who's editing…");
    expect(byText(container, "Take over")).toBeNull();
    expect(onBaton).not.toHaveBeenCalledWith({ groupId: "g-1", held: true });
  });

  test("the checking sentence is a read-state, not a held one — the chip carries no held modifier", async () => {
    api.mockImplementation(() => new Promise(() => {}));
    const { container } = await render();
    const chip = container.querySelector(".baton-chip");

    expect(chip).not.toBeNull();
    expect(chip.className).toBe("sync-chip baton-chip");
    expect(chip.getAttribute("title")).toBe("Checking who's editing…");
  });
});

describe("BatonChip — taking the baton delivers the group's head (fix round 1)", () => {
  test("a successful take pulls the head BEFORE the workspace is told the baton is theirs", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container, onBaton } = await render();

    let deliverHead = null;
    pullGroupProject.mockImplementationOnce(
      () => new Promise((resolve) => { deliverHead = resolve; }),
    );
    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });

    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    // The lease is ours server-side, but the head is still in flight: until
    // it lands, editing would be editing a stale copy — and the first save
    // would PUT it over whatever arrived while we watched.
    expect(pullGroupProject).toHaveBeenCalledWith("g-1");
    expect(onBaton).not.toHaveBeenCalledWith({ groupId: "g-1", held: true });
    expect(chipText(container)).toBe("Read-only — Thabo is editing");

    await act(async () => {
      deliverHead(null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(chipText(container)).toBe("Editing — baton yours");
    expect(onBaton).toHaveBeenCalledWith({ groupId: "g-1", held: true });
  });

  test("re-taking your OWN lapsed lease pulls too — the baton was free, so anyone may have saved", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: -1000 }) });
    const { container } = await render();

    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(pullGroupProject).toHaveBeenCalledWith("g-1");
    expect(chipText(container)).toBe("Editing — baton yours");
  });

  test("a head that cannot be fetched leaves the workspace locked rather than editable over a stale copy", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container, onBaton } = await render();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    pullGroupProject.mockRejectedValueOnce(new Error("offline"));
    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(onBaton).not.toHaveBeenCalledWith({ groupId: "g-1", held: true });
    expect(byText(container, "Take over")).not.toBeNull();
    warn.mockRestore();
  });

  /* Final fix wave (Task 22 residual). `adopt` awaits the head, and the
     group-id check after that await only catches a change of GROUP. Two
     adopts of the SAME group can still interleave — a slow take-pull and a
     poll (or push-failure re-read) that lands while it is in flight — and
     the older one would then re-assert a baton the newer reading has already
     taken away, unlocking a workspace this member no longer owns. */
  test("a slow take-pull can never re-assert a baton a later reading has already taken away", async () => {
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: -1000 }) });
    const { container, onBaton } = await render();

    let deliverHead = null;
    pullGroupProject.mockImplementationOnce(
      () => new Promise((resolve) => { deliverHead = resolve; }),
    );
    api.mockResolvedValueOnce({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });

    await act(async () => {
      byText(container, "Take over").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(pullGroupProject).toHaveBeenCalledWith("g-1");

    // The lease moves on while that head is still in flight: a refused push
    // re-reads the baton and finds somebody else holding it.
    api.mockResolvedValueOnce({ baton: baton({ holderId: "u-3", holderName: "Naledi", ms: LIVE }) });
    await act(async () => {
      pushFailed(new Error("Another member holds the baton."));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(chipText(container)).toBe("Read-only — Naledi is editing");

    // The superseded pull finally lands. It must not put the baton back.
    await act(async () => {
      deliverHead(null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(chipText(container)).toBe("Read-only — Naledi is editing");
    expect(onBaton).not.toHaveBeenCalledWith({ groupId: "g-1", held: true });
  });

  test("the head is fetched once per turn, not on every poll while the baton stays yours", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    vi.useFakeTimers();
    mounted = mountComponent(<BatonChip onBaton={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(pullGroupProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40000);
    });
    expect(api).toHaveBeenCalledTimes(3);
    expect(pullGroupProject).toHaveBeenCalledTimes(1);
  });
});

describe("BatonChip — a refused group push corrects the chip at once (fix round 1)", () => {
  test("a failed push re-reads the baton immediately, not at the next 20 s tick", async () => {
    api.mockResolvedValue({ baton: baton({ holderId: ME.id, holderName: "Ada", ms: LIVE }) });
    const { container } = await render();
    expect(chipText(container)).toBe("Editing — baton yours");
    expect(api).toHaveBeenCalledTimes(1);

    api.mockResolvedValue({ baton: baton({ holderId: "u-2", holderName: "Thabo", ms: LIVE }) });
    await act(async () => {
      pushFailed(new Error("Another member holds the baton."));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api).toHaveBeenCalledTimes(2);
    expect(api).toHaveBeenLastCalledWith("/api/groups/g-1/baton");
    expect(chipText(container)).toBe("Read-only — Thabo is editing");
  });

  test("the subscription is dropped when the chip unmounts", async () => {
    const unsubscribe = vi.fn();
    onGroupPushFailed.mockImplementation((fn) => {
      pushFailed = fn;
      return unsubscribe;
    });
    api.mockResolvedValue({ baton: { holderId: null, holderName: null, expiresAt: null } });
    await render();

    mounted.unmount();
    mounted = null;

    expect(unsubscribe).toHaveBeenCalled();
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
