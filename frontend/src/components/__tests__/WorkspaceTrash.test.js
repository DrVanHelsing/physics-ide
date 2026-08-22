import { describe, test, expect, vi } from "vitest";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import WorkspaceTrash from "../WorkspaceTrash";

function fakeWorkspace() {
  const listeners = [];
  return {
    addChangeListener: (fn) => listeners.push(fn),
    removeChangeListener: vi.fn(),
    getComponentManager: () => ({ addComponent: vi.fn(), removeComponent: vi.fn() }),
    fire: (e) => listeners.forEach((fn) => fn(e)),
  };
}

describe("WorkspaceTrash", () => {
  test("hidden at rest, shown during a block drag", async () => {
    const ws = fakeWorkspace();
    const { container } = await mountComponent(
      <WorkspaceTrash workspaceRef={{ current: ws }} />
    );
    expect(container.querySelector(".workspace-trash--visible")).toBeFalsy();
    await act(() => ws.fire({ type: "drag", isStart: true }));
    expect(container.querySelector(".workspace-trash--visible")).toBeTruthy();
    await act(() => ws.fire({ type: "drag", isStart: false }));
    expect(container.querySelector(".workspace-trash--visible")).toBeFalsy();
  });
});
