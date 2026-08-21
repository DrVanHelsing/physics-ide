/**
 * Task 16 — the `booting` phase between Run and the first frame.
 *
 * Pressing Run flips `running` true immediately, but the runtime takes
 * however long six CDN scripts take to load and compile before the first
 * frame actually appears. Without a dedicated `booting` prop, the idle
 * placeholder ({!running}) would vanish the instant `running` flips,
 * leaving a blank rectangle behind for that whole window. The idle-layer
 * gate is `(!running || booting)` so the placeholder card stays put — with
 * the spinner overlay layered on top of it — until the runtime confirms.
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

describe("GlowCanvas — booting overlay", () => {
  test("fully idle: idle placeholder shows, booting overlay absent", () => {
    mounted = mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle")).not.toBeNull();
    expect(mounted.container.querySelector(".canvas-booting")).toBeNull();
  });

  test("mid-boot: the idle placeholder stays visible instead of yielding to a blank rectangle, and the spinner overlay appears on top of it", () => {
    mounted = mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle")).not.toBeNull();
    const overlay = mounted.container.querySelector(".canvas-booting");
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute("role")).toBe("status");
    expect(mounted.container.querySelector(".canvas-booting__label").textContent).toBe(
      "Starting simulation…",
    );
  });

  test("running and not booting: both the idle placeholder and the booting overlay are gone", () => {
    mounted = mountComponent(<GlowCanvas running booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-idle")).toBeNull();
    expect(mounted.container.querySelector(".canvas-booting")).toBeNull();
  });

  test("the booting overlay clears the moment booting flips false, without needing a running flip", () => {
    mounted = mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-booting")).not.toBeNull();

    mounted.rerender(<GlowCanvas running booting={false} onStatus={() => {}} />);
    expect(mounted.container.querySelector(".canvas-booting")).toBeNull();
    expect(mounted.container.querySelector(".canvas-idle")).toBeNull();
  });
});
