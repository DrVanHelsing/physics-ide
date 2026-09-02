import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import WalkthroughOverlay from "../WalkthroughOverlay";
import { TOURS, getTour } from "../../../walkthrough/tours";
import { mountComponent, click, keyDown, byText } from "../../../test/renderHelpers";

/* jsdom rects are all zero — give targets a real box so rectOf() sees them. */
function plantTarget(className) {
  const el = document.createElement("div");
  el.className = className;
  el.getBoundingClientRect = () => ({ x: 40, y: 40, width: 120, height: 32 });
  document.body.appendChild(el);
  return el;
}

/* The engine polls for its target every 250ms — let those timers drain. */
async function settle(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const TOUR = {
  id: "t",
  title: "Test tour",
  steps: [
    { target: ".wt-a", title: "Step A", body: "First." },
    { action: "run", target: ".wt-b", title: "Step B", body: "Second.", end: "stop" },
  ],
};

describe("WalkthroughOverlay — the guided-tour engine", () => {
  let mounted;
  beforeEach(() => {
    plantTarget("wt-a");
    plantTarget("wt-b");
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("renders the first step's narration over its target", async () => {
    mounted = mountComponent(
      <WalkthroughOverlay tour={TOUR} execute={vi.fn()} onEnd={vi.fn()} />,
    );
    await settle();
    const { container } = mounted;
    expect(container.textContent).toContain("Step A");
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-label")).toBe("Test tour — step 1 of 2");
    expect(container.querySelector(".walkthrough-spot")).not.toBeNull();
  });

  it("Next runs the following step's action exactly once and advances", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    mounted = mountComponent(
      <WalkthroughOverlay tour={TOUR} execute={execute} onEnd={vi.fn()} />,
    );
    await settle();
    click(byText(mounted.container, "Next"));
    await settle();
    expect(mounted.container.textContent).toContain("Step B");
    expect(execute).toHaveBeenCalledWith("run");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("Finish on the last step ends the tour and runs its end action", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onEnd = vi.fn();
    mounted = mountComponent(
      <WalkthroughOverlay tour={TOUR} execute={execute} onEnd={onEnd} />,
    );
    await settle();
    click(byText(mounted.container, "Next"));
    await settle();
    click(byText(mounted.container, "Finish"));
    expect(onEnd).toHaveBeenCalledWith("finished");
    // The step carried end:"stop" — a tour must never leave a run going.
    expect(execute).toHaveBeenCalledWith("stop");
  });

  it("Escape dismisses — and still cleans up a running step's end action", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const onEnd = vi.fn();
    mounted = mountComponent(
      <WalkthroughOverlay tour={TOUR} execute={execute} onEnd={onEnd} />,
    );
    await settle();
    click(byText(mounted.container, "Next"));
    await settle();
    keyDown(document, { key: "Escape" });
    expect(onEnd).toHaveBeenCalledWith("dismissed");
    expect(execute).toHaveBeenCalledWith("stop");
  });

  it("a step whose target never appears is skipped, not fatal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = {
      id: "t2",
      title: "Skip tour",
      steps: [
        { target: ".wt-never", title: "Ghost", body: "…" },
        { target: ".wt-a", title: "Real", body: "…" },
      ],
    };
    vi.useFakeTimers();
    mounted = mountComponent(
      <WalkthroughOverlay tour={tour} execute={vi.fn()} onEnd={vi.fn()} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9500);
    });
    vi.useRealTimers();
    await settle();
    expect(mounted.container.textContent).toContain("Real");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(".wt-never"));
    warn.mockRestore();
  });
});

describe("the shipped tour definitions", () => {
  it("every tour has steps, titles, targets, and a known shape", () => {
    expect(TOURS.length).toBeGreaterThanOrEqual(6);
    for (const t of TOURS) {
      expect(t.id).toMatch(/^[a-z-]+$/);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      for (const s of t.steps) {
        expect(typeof s.target).toBe("string");
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(20);
        if (s.action) {
          expect(s.action).toMatch(/^(openTemplate:[a-z_]+|run|stop|mode:(code|blocks))$/);
        }
        if (s.end) expect(s.end).toMatch(/^(stop)$/);
      }
    }
  });

  it("every openTemplate action names a template resolvePendingTemplateSpec accepts", async () => {
    const { resolvePendingTemplateSpec } = await import("../../StartMenu");
    for (const t of TOURS) {
      for (const s of t.steps) {
        if (s.action?.startsWith("openTemplate:")) {
          const id = s.action.slice("openTemplate:".length);
          expect(resolvePendingTemplateSpec(id), `${t.id}: ${id}`).not.toBeNull();
        }
      }
    }
  });

  it("getTour finds by id and rejects strangers", () => {
    expect(getTour("first-simulation")?.title).toBe("Your first simulation");
    expect(getTour("nope")).toBeNull();
  });
});
