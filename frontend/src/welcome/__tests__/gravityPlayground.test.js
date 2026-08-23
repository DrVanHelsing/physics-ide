import { describe, test, expect, afterEach } from "vitest";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import GravityPlayground from "../GravityPlayground";

/* Plan 5 Task 12: the slider becomes a real, labelled, themed .range; the
   canvas gets a text alternative and an honest statement about its
   keyboard story; the Play/Pause button retires the last .welcome-btn
   site in the codebase. */

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

/** Sets a range input's value the way a real drag does, so React's
 *  tracked-value check doesn't swallow the change (see ProjectTitle.test.js's
 *  `type()` for the same trick applied to a text input). */
function changeRange(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
});

describe("GravityPlayground — the slider is a real, labelled, themed .range", () => {
  test("carries the .range class, an accessible label, and a unit-bearing aria-valuetext", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const input = container.querySelector("#welcome-gravity");
    expect(input).toBeTruthy();
    expect(input.className).toMatch(/\brange\b/);

    const label = container.querySelector('label[for="welcome-gravity"]');
    expect(label).toBeTruthy();
    expect(label.textContent.trim()).toBe("Gravity");

    expect(input.getAttribute("aria-valuetext")).toBe("9.8 metres per second squared");
  });

  test("changing the slider updates both the visible readout and aria-valuetext", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const input = container.querySelector("#welcome-gravity");

    changeRange(input, 20);

    expect(container.querySelector(".welcome-playground__value").textContent).toBe("20.0 m/s²");
    expect(input.getAttribute("aria-valuetext")).toBe("20.0 metres per second squared");
  });
});

describe("GravityPlayground — Play/Pause", () => {
  test("toggles aria-pressed and its own visible label on click", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const btn = byText(container, "Pause") ?? byText(container, "Play");
    expect(btn).toBeTruthy();
    const wasPressed = btn.getAttribute("aria-pressed") === "true";

    click(btn);

    expect(btn.getAttribute("aria-pressed")).toBe(String(!wasPressed));
    expect(btn.textContent).toBe(wasPressed ? "Play" : "Pause");
  });

  test("is the shared .btn/.btn--sm primitive, not the retired .welcome-btn alias", () => {
    mounted = mountComponent(<GravityPlayground />);
    const btn = mounted.container.querySelector(".welcome-playground__controls button");
    expect(btn.className).toMatch(/\bbtn\b/);
    expect(btn.className).toMatch(/\bbtn--sm\b/);
    expect(btn.className).not.toMatch(/welcome-btn/);
  });
});

describe("GravityPlayground — reduced motion (degrade, don't delete)", () => {
  test("with prefers-reduced-motion, mounts already paused: aria-pressed=false, labelled Play", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const btn = byText(mounted.container, "Play");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  test("without it, mounts already running: aria-pressed=true, labelled Pause", () => {
    setReducedMotion(false);
    mounted = mountComponent(<GravityPlayground />);
    const btn = byText(mounted.container, "Pause");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("GravityPlayground — the canvas gets a text alternative", () => {
  test("carries role=img and a description of what it shows", () => {
    mounted = mountComponent(<GravityPlayground />);
    const canvas = mounted.container.querySelector("canvas");
    expect(canvas.getAttribute("role")).toBe("img");
    expect(canvas.getAttribute("aria-label")).toMatch(/gravity/i);
    expect(canvas.getAttribute("aria-label")).toMatch(/ball/i);
  });

  test("an honest, visible statement covers the click-to-drop gesture's missing keyboard story", () => {
    mounted = mountComponent(<GravityPlayground />);
    const hint = mounted.container.querySelector(".welcome-playground__hint");
    expect(hint).toBeTruthy();
    expect(hint.getAttribute("aria-hidden")).not.toBe("true");
    expect(hint.textContent).toMatch(/decorative/i);
    expect(hint.textContent).toMatch(/keyboard/i);
    expect(hint.textContent).toMatch(/slider/i);
  });
});
