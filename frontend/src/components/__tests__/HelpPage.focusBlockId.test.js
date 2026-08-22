/**
 * HelpPage.focusBlockId.test.js — Regression proof for Plan 4 / Task 11.
 *
 * A block's right-click → Help now opens `#/help?block=<id>`, which
 * IDELayout intercepts and turns into a `focusBlockId` prop on HelpPage. The
 * deep-link effect looks up `#help-block-<id>`, scrolls it into view, and
 * rings it with `.help-block-entry--focused` for two seconds.
 *
 * jsdom implements neither `IntersectionObserver` (HelpPage's active-section
 * tracker uses one unconditionally) nor `Element.scrollIntoView` — the
 * effect under test guards the latter with `?.()` specifically so it does
 * not throw here. This suite stubs the former locally (HelpPage.js itself
 * is untouched) and treats the absence of the latter as the very condition
 * the guard exists for, rather than polyfilling it away.
 */
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import React from "react";
import HelpPage from "../HelpPage";
import { mountComponent } from "../../test/renderHelpers";

// jsdom has no IntersectionObserver; HelpPage's active-section tracker
// constructs one unconditionally on mount. Stub it here rather than in
// setupTests.js — Task 11 touches test files only, not shared test setup.
let originalIO;
beforeAll(() => {
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  globalThis.IntersectionObserver = originalIO;
});

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function render(props = {}) {
  mounted?.unmount();
  mounted = mountComponent(<HelpPage onClose={() => {}} {...props} />);
  return mounted.container;
}

describe("HelpPage focusBlockId deep link", () => {
  test("mounts cleanly with no focusBlockId (the default, unlinked case)", () => {
    const container = render();
    expect(container.querySelector(".help-overlay")).not.toBeNull();
  });

  test("jsdom sanity: scrollIntoView is genuinely absent, which is exactly what the guard is for", () => {
    render();
    const anyEl = document.querySelector(".help-block-row");
    expect(anyEl.scrollIntoView).toBeUndefined();
  });

  test("a focusBlockId highlights its block-reference row without throwing", () => {
    const container = render({ focusBlockId: "sphere_block" });
    const row = container.querySelector("#help-block-sphere_block");
    expect(row).not.toBeNull();
    expect(row.classList.contains("help-block-entry--focused")).toBe(true);
  });

  test("the highlight clears after the timeout", () => {
    vi.useFakeTimers();
    try {
      const container = render({ focusBlockId: "sphere_block" });
      const row = container.querySelector("#help-block-sphere_block");
      expect(row.classList.contains("help-block-entry--focused")).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(row.classList.contains("help-block-entry--focused")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("an unknown focusBlockId is a silent no-op (no matching anchor)", () => {
    const container = render({ focusBlockId: "not_a_real_block" });
    const focused = container.querySelectorAll(".help-block-entry--focused");
    expect(focused.length).toBe(0);
  });

  test("a combined row's alias id (math_max_block) highlights the shared row, not the hidden alias span", () => {
    const container = render({ focusBlockId: "math_max_block" });
    const row = container.querySelector("#help-block-math_min_block");
    const alias = container.querySelector("#help-block-math_max_block");
    expect(row).not.toBeNull();
    expect(alias).not.toBeNull();
    expect(row.classList.contains("help-block-entry--focused")).toBe(true);
    expect(alias.classList.contains("help-block-entry--focused")).toBe(false);
  });

  test("changing focusBlockId across a re-render moves the highlight", () => {
    mounted = mountComponent(<HelpPage onClose={() => {}} focusBlockId="sphere_block" />);
    const container = mounted.container;
    expect(container.querySelector("#help-block-sphere_block").classList.contains("help-block-entry--focused")).toBe(true);

    mounted.rerender(<HelpPage onClose={() => {}} focusBlockId="box_block" />);
    expect(container.querySelector("#help-block-sphere_block").classList.contains("help-block-entry--focused")).toBe(false);
    expect(container.querySelector("#help-block-box_block").classList.contains("help-block-entry--focused")).toBe(true);
  });
});
