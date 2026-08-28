import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import SettingsTab from "../SettingsTab";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useMutation } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "c1" }) }));

const { classHolder } = vi.hoisted(() => ({
  classHolder: { data: { id: "c1", name: "9B", subjectLabel: null, joinMode: "open", archived: false, peerSharing: false } },
}));
vi.mock("../ClassChrome", () => ({
  default: ({ children }) => children(classHolder.data, { id: "u1" }),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
  classHolder.data = { ...classHolder.data, peerSharing: false };
});

describe("SettingsTab — sharing rules (spec §8.3, design D§5.1)", () => {
  test("the section renders both doors, Off selected by default, and On fires the patch", () => {
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false });
    mounted = mountComponent(<SettingsTab />);
    const container = mounted.container;

    expect(byText(container, "Sharing rules", "h2")).not.toBeNull();
    const doors = [...container.querySelectorAll('input[name="peerSharing"]')];
    expect(doors).toHaveLength(2);
    expect(doors[0].checked).toBe(true); // Off is the default (spec §8.3)

    click(doors[1]);
    expect(mutate).toHaveBeenCalledWith({ peerSharing: true });
  });
});
