import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { ProjectRow } from "../../StartMenu";
import AttributionChip from "../../layout/AttributionChip";
import { mountComponent } from "../../../test/renderHelpers";
import { getShareAttribution } from "../../../utils/storage/shareMeta";
import { refreshShareAttributions } from "../../../utils/sharing/attribution";

/**
 * Both surfaces of the label (spec §8.1): the StartMenu library row's
 * `.start-project-attrib` line, and the IDE status bar's AttributionChip.
 * ProjectRow renders synchronously off the `attribution` prop StartMenu
 * passes down; AttributionChip resolves its own sidecar read via an effect,
 * so those tests await it. "Removed student" (§11's erasure) is exercised
 * as an ordinary name — no special branch in either component.
 *
 * AttributionChip's second path (a deep-linked/reloaded session on a
 * second device, whose sidecar has no record yet) calls
 * refreshShareAttributions() — kept real for attributionSentence but
 * stubbed for that call so these tests control what the "server" returns.
 */
vi.mock("../../../utils/storage/shareMeta", () => ({ getShareAttribution: vi.fn() }));
vi.mock("../../../utils/sharing/attribution", async () => {
  const actual = await vi.importActual("../../../utils/sharing/attribution");
  return { ...actual, refreshShareAttributions: vi.fn() };
});

const PROJECT = { id: "p-1", title: "Pendulum lab", goal: "physics", updatedAt: Date.now() };

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

describe("ProjectRow — the library row's attribution line", () => {
  test("with an attribution, renders the sentence in .start-project-attrib", () => {
    mounted = mountComponent(
      <ProjectRow
        project={PROJECT}
        attribution={{ sharerName: "Thabo M." }}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );
    const node = mounted.container.querySelector(".start-project-attrib");
    expect(node).not.toBeNull();
    expect(node.textContent).toBe("Based on work shared by Thabo M.");
  });

  test("without the prop, the node is absent", () => {
    mounted = mountComponent(
      <ProjectRow project={PROJECT} onOpen={() => {}} onDelete={() => {}} />,
    );
    expect(mounted.container.querySelector(".start-project-attrib")).toBeNull();
  });
});

describe("AttributionChip — the status-bar identity surface", () => {
  test("a seeded sidecar entry renders the sentence in a .sync-chip", async () => {
    getShareAttribution.mockResolvedValue({
      shareId: "s-1",
      sharerId: "u-1",
      sharerName: "Thabo M.",
    });

    mounted = mountComponent(<AttributionChip projectId="p-1" />);
    await flush();

    expect(getShareAttribution).toHaveBeenCalledWith("p-1");
    expect(refreshShareAttributions).not.toHaveBeenCalled();
    const chip = mounted.container.querySelector(".sync-chip.attribution-chip");
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("Based on work shared by Thabo M.");
    expect(chip.getAttribute("title")).toBe("Based on work shared by Thabo M.");
  });

  test("no sidecar entry, and a second-device refresh finds nothing either: renders nothing", async () => {
    getShareAttribution.mockResolvedValue(null);
    refreshShareAttributions.mockResolvedValue({});

    mounted = mountComponent(<AttributionChip projectId="p-1" />);
    await flush();

    expect(refreshShareAttributions).toHaveBeenCalled();
    expect(mounted.container.firstChild).toBeNull();
  });

  test("no sidecar entry, but a second-device refresh finds this project's attribution: renders the sentence after the effect", async () => {
    getShareAttribution.mockResolvedValue(null);
    refreshShareAttributions.mockResolvedValue({
      "p-1": { shareId: "s-2", sharerId: "u-2", sharerName: "Naledi K." },
    });

    mounted = mountComponent(<AttributionChip projectId="p-1" />);
    await flush();

    const chip = mounted.container.querySelector(".sync-chip.attribution-chip");
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("Based on work shared by Naledi K.");
  });

  test("no projectId renders nothing and never reads the sidecar", async () => {
    mounted = mountComponent(<AttributionChip projectId={null} />);
    await flush();

    expect(getShareAttribution).not.toHaveBeenCalled();
    expect(mounted.container.firstChild).toBeNull();
  });

  test("'Removed student' (an erased sharer) is just a name — no special path", async () => {
    getShareAttribution.mockResolvedValue({
      shareId: "s-1",
      sharerId: "u-1",
      sharerName: "Removed student",
    });

    mounted = mountComponent(<AttributionChip projectId="p-1" />);
    await flush();

    const chip = mounted.container.querySelector(".sync-chip.attribution-chip");
    expect(chip.textContent).toBe("Based on work shared by Removed student");
    expect(refreshShareAttributions).not.toHaveBeenCalled();
  });
});
