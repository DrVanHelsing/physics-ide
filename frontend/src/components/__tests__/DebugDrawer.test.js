/**
 * Task 17 — the docked trace drawer.
 *
 * The .debug-drawer / .debug-drawer-handle rules had existed in the stylesheet
 * since before Tranche 3 with no component rendering into them. This is that
 * component: the trace table, docked beside the viewport, with a handle that
 * is a real focusable separator rather than a drag-only strip.
 *
 * TraceTable reads `watch`/`addWatch` straight off TraceContext, so every
 * mount needs a real <TraceProvider> around it.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import DebugDrawer from "../DebugDrawer";
import { TraceProvider } from "../../contexts/TraceContext";
import { mountComponent, click, keyDown } from "../../test/renderHelpers";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function render(props = {}) {
  mounted?.unmount();
  mounted = mountComponent(
    <TraceProvider>
      <DebugDrawer traceData={new Map()} onClearTrace={() => {}} {...props} />
    </TraceProvider>,
  );
  return mounted.container;
}

const handleOf = (c) => c.querySelector(".debug-drawer-handle");
const drawerOf = (c) => c.querySelector(".debug-drawer");
const widthOf = (c) => parseInt(drawerOf(c).style.width, 10);

describe("DebugDrawer", () => {
  test("renders the trace panel into the drawer the CSS has always described", () => {
    const container = render();
    expect(drawerOf(container)).not.toBeNull();
    expect(drawerOf(container).querySelector(".trace-panel")).not.toBeNull();
    expect(handleOf(container)).not.toBeNull();
  });

  test("the handle is a keyboard-reachable separator, not a drag-only strip", () => {
    const handle = handleOf(render());
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-label")).toBe("Resize the trace panel");
    expect(handle.tabIndex).toBe(0);
  });

  test("ArrowLeft widens the drawer and ArrowRight narrows it", () => {
    const container = render();
    const handle = handleOf(container);
    const start = widthOf(container);

    keyDown(handle, { key: "ArrowLeft" });
    expect(widthOf(container)).toBe(start + 16);

    keyDown(handle, { key: "ArrowRight" });
    keyDown(handle, { key: "ArrowRight" });
    expect(widthOf(container)).toBe(start - 16);
  });

  test("the width is clamped — a held key cannot squeeze the viewport away or swallow it", () => {
    const container = render();
    const handle = handleOf(container);

    for (let i = 0; i < 40; i += 1) keyDown(handle, { key: "ArrowRight" });
    expect(widthOf(container)).toBe(200);

    for (let i = 0; i < 60; i += 1) keyDown(handle, { key: "ArrowLeft" });
    expect(widthOf(container)).toBe(500);
  });

  test("keys other than the arrows are left alone", () => {
    const container = render();
    const start = widthOf(container);
    keyDown(handleOf(container), { key: "Enter" });
    expect(widthOf(container)).toBe(start);
  });

  test("the trace table's Clear button reaches onClearTrace", () => {
    const onClearTrace = vi.fn();
    const container = render({ onClearTrace });
    click(container.querySelector(".trace-clear-btn"));
    expect(onClearTrace).toHaveBeenCalledTimes(1);
  });

  test("recording controls are wired through to the panel", () => {
    const onStartRecord = vi.fn();
    const container = render({
      traceData: new Map([["x", { value: "1", count: 2, blockId: "b1", delta: 0, min: 0, max: 1, history: [] }]]),
      onStartRecord,
      onStopRecord: () => {},
      recordBuffer: [],
    });
    const rec = container.querySelector(".trace-rec-btn");
    expect(rec).not.toBeNull();
    click(rec);
    expect(onStartRecord).toHaveBeenCalledTimes(1);
  });
});
