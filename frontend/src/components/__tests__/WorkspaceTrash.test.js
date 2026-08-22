import { describe, test, expect, vi } from "vitest";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import WorkspaceTrash from "../WorkspaceTrash";

function fakeWorkspace() {
  const listeners = [];
  // One persistent manager instance (not a fresh object per call) so a test
  // can call getComponentManager() again after the fact and still see the
  // same addComponent mock the component itself registered against.
  const manager = { addComponent: vi.fn(), removeComponent: vi.fn() };
  return {
    addChangeListener: (fn) => listeners.push(fn),
    removeChangeListener: vi.fn(),
    getComponentManager: () => manager,
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

  test("picks up the workspace once workspaceRef.current appears after mount — the normal BlocklyWorkspace mount order", () => {
    // BlocklyWorkspace assigns workspaceRef.current inside its OWN mount
    // effect, which fires AFTER this component's effects (React runs child
    // effects before parent effects). So workspaceRef.current === null on
    // every real mount is the default case, not a rare edge case — this test
    // simulates it by attaching the ref only after WorkspaceTrash has mounted.
    vi.useFakeTimers();
    const workspaceRef = { current: null };
    const { container, unmount } = mountComponent(
      <WorkspaceTrash workspaceRef={workspaceRef} />
    );
    try {
      expect(container.querySelector(".workspace-trash--visible")).toBeFalsy();

      const ws = fakeWorkspace();
      workspaceRef.current = ws;

      // One 50ms poll tick is enough for the component to notice and subscribe.
      act(() => {
        vi.advanceTimersByTime(50);
      });

      act(() => ws.fire({ type: "drag", isStart: true }));
      expect(container.querySelector(".workspace-trash--visible")).toBeTruthy();
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  test("toggles is-dragging-block on the parent element across the drag lifecycle", () => {
    const ws = fakeWorkspace();
    const { container, unmount } = mountComponent(
      <WorkspaceTrash workspaceRef={{ current: ws }} />
    );
    try {
      // mountComponent's own container is WorkspaceTrash's rendered parent.
      expect(container.classList.contains("is-dragging-block")).toBe(false);

      act(() => ws.fire({ type: "drag", isStart: true }));
      expect(container.classList.contains("is-dragging-block")).toBe(true);

      act(() => ws.fire({ type: "drag", isStart: false }));
      expect(container.classList.contains("is-dragging-block")).toBe(false);
    } finally {
      unmount();
    }
  });

  test("registers a real Blockly delete-area/drag-target component while visible", () => {
    // The component itself (not this test) constructs the TrashZone and
    // hands it to the workspace's ComponentManager — capture that instance
    // via the fake addComponent's own call args, the same way the real
    // ComponentManager would receive it, rather than reaching into
    // WorkspaceTrash's internals.
    const ws = fakeWorkspace();
    const { unmount } = mountComponent(<WorkspaceTrash workspaceRef={{ current: ws }} />);
    try {
      act(() => ws.fire({ type: "drag", isStart: true }));
      const manager = ws.getComponentManager();
      expect(manager.addComponent).toHaveBeenCalledTimes(1);
      const registered = manager.addComponent.mock.calls[0][0];
      expect(registered.component.id).toBe("physicsTrashZone");
      expect(typeof registered.component.onDragEnter).toBe("function");
      expect(typeof registered.component.onDragExit).toBe("function");
      expect(typeof registered.component.onDrop).toBe("function");
    } finally {
      unmount();
    }
  });

  test("onDragEnter/onDragExit toggle the hover (lid + danger colour) class", () => {
    const ws = fakeWorkspace();
    const { container, unmount } = mountComponent(
      <WorkspaceTrash workspaceRef={{ current: ws }} />
    );
    try {
      act(() => ws.fire({ type: "drag", isStart: true }));
      const zone = ws.getComponentManager().addComponent.mock.calls[0][0].component;

      expect(container.querySelector(".workspace-trash--hover")).toBeFalsy();
      act(() => zone.onDragEnter());
      expect(container.querySelector(".workspace-trash--hover")).toBeTruthy();
      act(() => zone.onDragExit());
      expect(container.querySelector(".workspace-trash--hover")).toBeFalsy();
    } finally {
      unmount();
    }
  });

  test("onDrop clears the hover state (the drag has ended, deleted or not)", () => {
    const ws = fakeWorkspace();
    const { container, unmount } = mountComponent(
      <WorkspaceTrash workspaceRef={{ current: ws }} />
    );
    try {
      act(() => ws.fire({ type: "drag", isStart: true }));
      const zone = ws.getComponentManager().addComponent.mock.calls[0][0].component;

      act(() => zone.onDragEnter());
      expect(container.querySelector(".workspace-trash--hover")).toBeTruthy();
      act(() => zone.onDrop());
      expect(container.querySelector(".workspace-trash--hover")).toBeFalsy();
    } finally {
      unmount();
    }
  });
});
