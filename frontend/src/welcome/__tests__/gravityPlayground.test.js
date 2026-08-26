import { describe, test, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import GravityPlayground, {
  stepBall,
  effectiveRadius,
  PX_PER_METER,
  DEFAULT_GRAVITY,
  DEFAULT_RADIUS,
  DEFAULT_RESTITUTION,
  GRAVITY_RANGE,
  GRAVITY_PRESETS,
  RADIUS_RANGE,
  RESTITUTION_RANGE,
} from "../GravityPlayground";

/* v2 (redesign brief): GravityPlayground is promoted from a boxed "try it"
   section artifact — slider, Play/Pause, three gravity presets — into the
   hero's own full-bleed, ambient canvas. The click/drop gesture stays
   decorative and keyboard-free (no lock needed beyond "does not throw").

   v3 added a quiet control cluster: three real .range sliders (gravity,
   ball size, bounciness) plus a Reset — bottom-corner, low-opacity until
   hover/keyboard-focus, each control keyboard-operable with a visible label
   and an aria-valuetext carrying units.

   v4 (fix round, after review): size and bounciness are no longer sliders
   — live-resizing balls already mid-flight was flagged as its own kind of
   dishonesty, so both are fixed at their defaults now (GravityPlayground.js
   keeps the values in `settings` for stepBall's sake; RADIUS_RANGE and
   RESTITUTION_RANGE stay exported and still exercised below because
   stepBall's own generality across those bounds is still real and still
   worth locking, even with no slider driving it today). Gravity keeps its
   slider and gains three preset chips (Moon/Earth/Jupiter) whose pressed
   state is real UI state, not derived from the number — Reset can
   therefore honestly show no preset selected even though it lands gravity
   back on Earth's own 9.8. A Trails toggle (aria-pressed, same idiom as
   the old Play/Pause) rounds the cluster out; it has nothing to do with
   the physics, just a fading record of where each ball already went. */

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

/** Drag a .range input to `value` the way a real pointer would — the native
 *  value setter plus a bubbling "input" event, which is the event React's
 *  onChange normalises range/number/text inputs onto (the same idiom
 *  guides.test.js and assignmentEditor.test.js already use). */
function setRange(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
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
});

describe("the physics controls cluster (v4) — one slider, three presets, a Trails toggle, a Reset", () => {
  test("a labelled group with exactly one .range slider — Gravity — and nothing else sliderish", () => {
    setReducedMotion(true); // paused: no rAF loop to race the assertions below
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const group = container.querySelector('[role="group"][aria-label="Adjust the canvas physics"]');
    expect(group).toBeTruthy();
    expect(group.className).toBe("welcome-hero__controls");

    const ranges = [...group.querySelectorAll("input.range")];
    expect(ranges).toHaveLength(1);

    const labels = [...group.querySelectorAll("label")].map((l) => l.textContent.trim());
    expect(labels).toEqual(["Gravity"]);

    // The label points at the real range input by id (the precedent idiom).
    const label = group.querySelector("label");
    const target = container.querySelector(`#${label.getAttribute("for")}`);
    expect(target).toBeTruthy();
    expect(target.className).toContain("range");
  });

  test("gravity defaults to the old fixed-engine constant, over its spec'd range, in its own units", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const gravity = container.querySelector("#hero-gravity");
    expect(Number(gravity.value)).toBe(DEFAULT_GRAVITY);
    expect(gravity.getAttribute("aria-valuetext")).toMatch(/9\.8 metres per second squared/);
    expect([Number(gravity.min), Number(gravity.max)]).toEqual(GRAVITY_RANGE);
  });

  test("dragging the gravity slider updates its value and aria-valuetext live", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const gravity = container.querySelector("#hero-gravity");
    setRange(gravity, 20);
    const updated = container.querySelector("#hero-gravity");
    expect(Number(updated.value)).toBe(20);
    expect(updated.getAttribute("aria-valuetext")).toMatch(/20\.0 metres per second squared/);
  });

  test("exactly the three named presets, real values, real units in the visible label", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const presetGroup = container.querySelector('[role="group"][aria-label="Gravity presets"]');
    expect(presetGroup).toBeTruthy();
    const chips = [...presetGroup.querySelectorAll("button")];
    expect(chips.map((b) => b.textContent.trim())).toEqual(["Moon 1.6", "Earth 9.8", "Jupiter 24.8"]);
    expect(GRAVITY_PRESETS).toEqual([
      { label: "Moon", value: 1.6 },
      { label: "Earth", value: 9.8 },
      { label: "Jupiter", value: 24.8 },
    ]);
  });

  test("no preset reads as pressed at rest, even though the default gravity (9.8) equals Earth's own value", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const chips = [...container.querySelectorAll('[aria-label="Gravity presets"] button')];
    for (const chip of chips) expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking a preset sets the slider to its exact value and shows only that chip pressed", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    click(byText(container, "Moon 1.6"));

    const gravity = container.querySelector("#hero-gravity");
    expect(Number(gravity.value)).toBe(1.6);
    expect(gravity.getAttribute("aria-valuetext")).toMatch(/1\.6 metres per second squared/);

    const [moon, earth, jupiter] = [...container.querySelectorAll('[aria-label="Gravity presets"] button')];
    expect(moon.getAttribute("aria-pressed")).toBe("true");
    expect(earth.getAttribute("aria-pressed")).toBe("false");
    expect(jupiter.getAttribute("aria-pressed")).toBe("false");
  });

  test("hand-moving the slider afterwards deselects the preset that was pressed", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    click(byText(container, "Jupiter 24.8"));
    expect(byText(container, "Jupiter 24.8").getAttribute("aria-pressed")).toBe("true");

    setRange(container.querySelector("#hero-gravity"), 15);

    for (const chip of container.querySelectorAll('[aria-label="Gravity presets"] button')) {
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("the Trails toggle is a real aria-pressed button, off by default, flipping on each click", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const trails = byText(container, "Trails");
    expect(trails).toBeTruthy();
    expect(trails.className).toContain("btn");
    expect(trails.getAttribute("aria-pressed")).toBe("false");
    click(trails);
    expect(byText(container, "Trails").getAttribute("aria-pressed")).toBe("true");
    click(byText(container, "Trails"));
    expect(byText(container, "Trails").getAttribute("aria-pressed")).toBe("false");
  });

  test("Reset restores the slider to default and deselects every preset, even Earth, and turns Trails off", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    click(byText(container, "Jupiter 24.8"));
    click(byText(container, "Trails"));

    const reset = byText(container, "Reset");
    expect(reset).toBeTruthy();
    expect(reset.className).toContain("btn");
    expect(reset.className).toContain("btn--sm");
    click(reset);

    expect(Number(container.querySelector("#hero-gravity").value)).toBe(DEFAULT_GRAVITY);
    for (const chip of container.querySelectorAll('[aria-label="Gravity presets"] button')) {
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
    expect(byText(container, "Trails").getAttribute("aria-pressed")).toBe("false");
  });

  test("no mass control, and no size/bounciness sliders either — free-fall in vacuum is mass-independent and live-resizing was ruled dishonest", () => {
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const { container } = mounted;
    const labels = [...container.querySelectorAll("label")].map((l) => l.textContent.trim());
    expect(labels.some((l) => /mass|size|bounc/i.test(l))).toBe(false);
    expect(container.querySelectorAll("input.range")).toHaveLength(1);
  });
});

/* ── Reset's other job: forgetting every ball dropped since the canvas
   mounted, not just the settings. This needs the real render path (the
   mount effect bails out entirely when canvas.getContext() is falsy,
   which is jsdom's default — see setupTests.js), so these two tests stub
   getContext with a spy-instrumented 2D context and count arc() calls per
   frame as a proxy for "how many balls did this frame draw." Scoped to
   this describe block only: every other test in this file is deliberately
   indifferent to whether the canvas can actually draw. ─────────────────── */
describe("Reset also forgets every dropped ball — the initial three-ball set, not zero and not the drop count", () => {
  let realGetContext;
  let ctx;

  function stubCanvas() {
    realGetContext = window.HTMLCanvasElement.prototype.getContext;
    ctx = { clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: "" };
    window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
  }

  afterEach(() => {
    if (realGetContext) window.HTMLCanvasElement.prototype.getContext = realGetContext;
    realGetContext = undefined;
  });

  test("a fresh mount draws exactly the three initial balls", () => {
    stubCanvas();
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  test("dropping balls grows the drawn count, and Reset brings it back to exactly three", () => {
    stubCanvas();
    setReducedMotion(true);
    mounted = mountComponent(<GravityPlayground />);
    const canvas = mounted.container.querySelector("canvas");

    ctx.arc.mockClear();
    canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(ctx.arc).toHaveBeenCalledTimes(4); // 3 initial + 1 just dropped

    ctx.arc.mockClear();
    canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 }));
    expect(ctx.arc).toHaveBeenCalledTimes(5); // 3 initial + 2 dropped

    ctx.arc.mockClear();
    click(byText(mounted.container, "Reset"));
    expect(ctx.arc).toHaveBeenCalledTimes(3); // back to the initial set, not 5 and not 0
  });
});

/* ── Pure physics — no canvas, no rAF, no React. stepBall is the one frame
   of motion the render loop calls for every ball; testing it directly is
   what lets these numbers be checked against the textbook formulas instead
   of against a screenshot. ────────────────────────────────────────────── */
describe("stepBall — the pure physics step", () => {
  const NO_MOUSE = null;
  const OPEN_BOUNDS = { width: 1e6, height: 1e6 }; // far enough away that nothing ever collides

  test("dt<=0 is a no-op — returns the same ball, unchanged (what lets a paused/RM canvas redraw without advancing time)", () => {
    const ball = { x: 1, y: 2, vx: 3, vy: 4, rJitter: 0, color: "#fff" };
    const settings = { gravity: DEFAULT_GRAVITY, radius: DEFAULT_RADIUS, restitution: DEFAULT_RESTITUTION };
    expect(stepBall(ball, 0, settings, OPEN_BOUNDS, NO_MOUSE)).toBe(ball);
    expect(stepBall(ball, -1, settings, OPEN_BOUNDS, NO_MOUSE)).toBe(ball);
  });

  test("v += g·dt each frame — after N frames of free fall, vy = N·g(px/s²)·dt exactly", () => {
    const settings = { gravity: 9.8, radius: 0, restitution: 1 };
    let ball = { x: 0, y: 0, vx: 0, vy: 0, rJitter: 0, color: "#fff" };
    const dt = 0.1;
    for (let i = 0; i < 5; i++) ball = stepBall(ball, dt, settings, OPEN_BOUNDS, NO_MOUSE);
    const expectedVy = 5 * settings.gravity * PX_PER_METER * dt;
    expect(ball.vy).toBeCloseTo(expectedVy, 6);
  });

  test("a drop from height h lands at t ≈ sqrt(2h/g) — the textbook free-fall time, read back through PX_PER_METER", () => {
    const gravity = 9.8;
    const heightPx = 600;
    // effectiveRadius floors at 1px (defensive — real sliders never go below
    // RADIUS_RANGE[0]) even for radius:0, so the true contact point is
    // heightPx - r, not heightPx; asking effectiveRadius rather than
    // assuming r=0 keeps this test honest about what the code actually does.
    const settings = { gravity, radius: 0, restitution: 0.82 };
    const bounds = { width: 1e6, height: heightPx };
    const dt = 1 / 1000; // fine enough that discretisation error stays well under 1%
    let ball = { x: 0, y: 0, vx: 0, vy: 0, rJitter: 0, color: "#fff" };
    const r = effectiveRadius(ball, settings);
    const contactY = heightPx - r;
    let t = 0;
    let steps = 0;
    while (ball.y < contactY && steps < 100000) {
      ball = stepBall(ball, dt, settings, bounds, NO_MOUSE);
      t += dt;
      steps++;
    }
    const h = contactY / PX_PER_METER; // metres actually fallen, centre to contact
    const expectedT = Math.sqrt((2 * h) / gravity);
    expect(Math.abs(t - expectedT) / expectedT).toBeLessThan(0.01);
  });

  test("a bounce reflects vy and scales it by the restitution coefficient e — e=1 keeps all the speed, e=0 keeps none", () => {
    const settings = { gravity: 0, radius: 1, restitution: 0.5 }; // gravity=0 isolates the bounce term; radius=1 is effectiveRadius's own floor, so r is unambiguous
    const bounds = { width: 1e6, height: 1000 };
    const ball = { x: 0, y: 998, vx: 0, vy: 1000, rJitter: 0, color: "#fff" }; // falling fast, one step from the floor
    const result = stepBall(ball, 0.01, settings, bounds, NO_MOUSE);
    expect(result.y).toBe(999); // clamped to height - r = 1000 - 1
    expect(result.vy).toBeCloseTo(-500, 6); // -|vy| * e = -1000 * 0.5
  });

  test("across the whole restitution range: RESTITUTION_RANGE's floor keeps 30% of impact speed, its ceiling keeps 100%", () => {
    const bounds = { width: 1e6, height: 1000 };
    const falling = { x: 0, y: 998, vx: 0, vy: 1000, rJitter: 0, color: "#fff" };
    const floor = stepBall(falling, 0.01, { gravity: 0, radius: 1, restitution: RESTITUTION_RANGE[0] }, bounds, NO_MOUSE);
    expect(floor.vy).toBeCloseTo(-1000 * RESTITUTION_RANGE[0], 6);
    const ceiling = stepBall(falling, 0.01, { gravity: 0, radius: 1, restitution: RESTITUTION_RANGE[1] }, bounds, NO_MOUSE);
    expect(ceiling.vy).toBeCloseTo(-1000, 6);
  });

  test("a perfectly elastic bounce (e=1) keeps 100% of the impact speed; e=0 kills it dead", () => {
    const bounds = { width: 1e6, height: 1000 };
    const falling = { x: 0, y: 998, vx: 0, vy: 1000, rJitter: 0, color: "#fff" };
    const elastic = stepBall(falling, 0.01, { gravity: 0, radius: 1, restitution: 1 }, bounds, NO_MOUSE);
    expect(elastic.vy).toBeCloseTo(-1000, 6);
    const dead = stepBall(falling, 0.01, { gravity: 0, radius: 1, restitution: 0 }, bounds, NO_MOUSE);
    expect(Math.abs(dead.vy)).toBe(0);
  });

  test("radius affects the floor-contact height — a bigger ball's centre stops further from the floor line", () => {
    const bounds = { width: 1e6, height: 500 };
    const falling = { x: 0, y: 498, vx: 0, vy: 1000, rJitter: 0, color: "#fff" };
    const small = stepBall(falling, 0.01, { gravity: 0, radius: RADIUS_RANGE[0], restitution: 1 }, bounds, NO_MOUSE);
    const big = stepBall(falling, 0.01, { gravity: 0, radius: RADIUS_RANGE[1], restitution: 1 }, bounds, NO_MOUSE);
    expect(small.y).toBe(500 - RADIUS_RANGE[0]);
    expect(big.y).toBe(500 - RADIUS_RANGE[1]);
    expect(big.y).toBeLessThan(small.y); // the bigger ball's centre rests higher up (smaller y)
  });

  test("effectiveRadius adds a ball's fixed per-ball jitter to the slider's base — the size variety the old fixed build had", () => {
    const settings = { gravity: DEFAULT_GRAVITY, radius: DEFAULT_RADIUS, restitution: DEFAULT_RESTITUTION };
    expect(effectiveRadius({ rJitter: 0 }, settings)).toBe(DEFAULT_RADIUS);
    expect(effectiveRadius({ rJitter: 3 }, settings)).toBe(DEFAULT_RADIUS + 3);
  });

  test("the defaults are exactly the old hard-coded engine constants — Reset (and an untouched canvas) reproduce the pre-v3 behaviour", () => {
    expect(DEFAULT_GRAVITY).toBe(9.8);
    expect(DEFAULT_RADIUS).toBe(7);
    expect(DEFAULT_RESTITUTION).toBe(0.82);
    expect(PX_PER_METER).toBe(60);
  });
});
