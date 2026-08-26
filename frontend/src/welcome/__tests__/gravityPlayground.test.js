import { describe, test, expect, afterEach } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import GravityPlayground from "../GravityPlayground";

/* v2 (redesign brief): GravityPlayground is promoted from a boxed "try it"
   section artifact — slider, Play/Pause, three gravity presets — into the
   hero's own full-bleed, ambient canvas. All of that removed chrome had its
   own lock in this file (Plan 5 Task 12); this suite replaces it with
   what the promoted component actually offers: a decorative, accessible
   canvas that drops a ball on click/tap and degrades cleanly under
   prefers-reduced-motion. There is no keyboard-operable control left to
   lock — the redesign brief calls the click gesture decorative outright,
   with the statement carried in the canvas's own title attribute and
   aria-label rather than a separate visible hint paragraph. */

let mounted = null;
const realMatchMedia = globalThis.matchMedia;

/** setupTests.js's stub never matches (see its own comment) — this is the
 *  override it explicitly leaves room for. Only the reduced-motion query
 *  is ever made to match; everything else stays false, same as the stub. */
function setReducedMotion(matches) {
  globalThis.matchMedia = (query) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
});

describe("GravityPlayground — the hero's full-bleed, decorative canvas", () => {
  test("carries role=img, a description of what it shows, and a title attribute stating the click gesture is decorative", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const canvas = mounted.container.querySelector("canvas.welcome-hero__canvas");
    expect(canvas).toBeTruthy();
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/gravity|ball/i);
    expect(canvas.getAttribute("aria-label")).toMatch(/decorative/i);
    expect(canvas.getAttribute("title")).toMatch(/decorative/i);
    expect(canvas.getAttribute("title")).toMatch(/no keyboard equivalent/i);
  });

  test("mounts cleanly with motion allowed and with prefers-reduced-motion set, either way", () => {
    setReducedMotion(false);
    expect(() => {
      mounted = mountComponent(<GravityPlayground />);
    }).not.toThrow();
    mounted.unmount();

    setReducedMotion(true);
    expect(() => {
      mounted = mountComponent(<GravityPlayground />);
    }).not.toThrow();
  });

  test("a click/tap on the canvas does not throw — the drop-a-ball gesture, decorative and keyboard-free", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const canvas = mounted.container.querySelector("canvas");
    expect(() => {
      canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
      canvas.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 12, clientY: 12 }));
      canvas.dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));
    }).not.toThrow();
  });

  test("the retired boxed controls — slider, Play/Pause, gravity presets — do not come back", () => {
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    expect(container.querySelector("input[type='range']")).toBeNull();
    expect(container.querySelector(".welcome-playground__presets")).toBeNull();
    expect(container.querySelector(".welcome-playground__controls")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
