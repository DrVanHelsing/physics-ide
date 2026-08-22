/**
 * Task 16 / Task 12 — the `booting` phase between Run and the first frame.
 *
 * Pressing Run flips `running` true immediately, but the runtime takes
 * however long six CDN scripts take to load and compile before the first
 * frame actually appears. Without a dedicated `booting` prop, the idle
 * placeholder ({!running}) would vanish the instant `running` flips,
 * leaving a blank rectangle behind for that whole window. The idle-layer
 * gate is `(!running || booting)` so the placeholder card stays put until
 * the runtime confirms.
 *
 * Task 12 replaced the separate `.canvas-booting` spinner overlay with a
 * `.canvas-idle--booting` modifier on that same placeholder card — the idle
 * atom itself animates in place rather than a second element appearing on
 * top of it. See GlowCanvasBoot.test.js for the boot-atom contract itself;
 * this suite covers the idle-layer visibility/transition logic around it.
 */
import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import GlowCanvas from "../GlowCanvas";
import { mountComponent } from "../../test/renderHelpers";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("GlowCanvas — idle/booting layer", () => {
  test("fully idle: idle placeholder shows, not in the booting state", () => {
    mounted = mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle")).not.toBeNull();
    expect(mounted.container.querySelector(".canvas-idle--booting")).toBeNull();
    expect(mounted.container.querySelector(".canvas-booting")).toBeNull();
  });

  test("mid-boot: the idle placeholder stays visible instead of yielding to a blank rectangle, and gains the booting modifier", () => {
    mounted = mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    const idle = mounted.container.querySelector(".canvas-idle");
    expect(idle).not.toBeNull();
    expect(idle.classList.contains("canvas-idle--booting")).toBe(true);
    expect(mounted.container.querySelector(".canvas-booting")).toBeNull();
    expect(mounted.container.textContent).toContain("Starting simulation…");
  });

  test("running and not booting: the idle placeholder is gone entirely", () => {
    mounted = mountComponent(<GlowCanvas running booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle")).toBeNull();
    expect(mounted.container.querySelector(".canvas-idle--booting")).toBeNull();
  });

  test("the booting modifier clears the moment booting flips false, without needing a running flip", () => {
    mounted = mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle--booting")).not.toBeNull();

    mounted.rerender(<GlowCanvas running booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle--booting")).toBeNull();
    expect(mounted.container.querySelector(".canvas-idle")).toBeNull();
  });
});

/**
 * Task 17 — the drawer docks LATERAL to the viewport, not under it.
 *
 * .canvas-wrap used to be a flex column so .canvas-caption could sit beneath
 * the canvas. Adding the drawer as a plain sibling would have stacked it
 * under the viewport and put it in a fight with the caption for vertical
 * space. The column moved to its own box: .canvas-wrap is the ROW (column |
 * handle | drawer) and .canvas-column stacks the viewport above its caption.
 */
describe("GlowCanvas — the .canvas-column / children structure", () => {
  test("the viewport lives inside .canvas-column, itself inside .canvas-wrap", () => {
    mounted = mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    const column = mounted.container.querySelector(".canvas-wrap > .canvas-column");
    expect(column).not.toBeNull();
    expect(column.querySelector(".canvas-viewport")).not.toBeNull();
  });

  test("children render as the WRAP's child, beside the column — never inside it", () => {
    mounted = mountComponent(
      <GlowCanvas running={false} booting={false} onStatus={() => {}}>
        <aside className="debug-drawer" />
      </GlowCanvas>,
    );
    expect(mounted.container.querySelector(".canvas-wrap > .debug-drawer")).not.toBeNull();
    expect(mounted.container.querySelector(".canvas-column .debug-drawer")).toBeNull();
  });

  test("no children: the wrap holds the column alone", () => {
    mounted = mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-wrap").children).toHaveLength(1);
  });
});
