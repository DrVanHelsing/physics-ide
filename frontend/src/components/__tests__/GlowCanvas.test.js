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
