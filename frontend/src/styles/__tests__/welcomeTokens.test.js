import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { metricViolations } from "./metricLint";

/* The twin of primitivesTokens.test.js, pointed at the front page's own
   stylesheet. welcome.css was split out of platform.css on 2026-08-22 and
   rebuilt onto tokens in Plan 5 Task 11; this is what stops it drifting back. */
const CSS = readFileSync(resolve(__dirname, "../welcome.css"), "utf8");

describe("welcome.css — built from the ramp, not from pixels", () => {
  test("no literal metric on any property the pass governs", () => {
    expect(metricViolations(CSS)).toEqual([]);
  });

  test("theming is data-theme only — not one prefers-color-scheme rule in the app", () => {
    expect(CSS).not.toMatch(/prefers-color-scheme/);
  });

  test("the one focus ring is not overridden here", () => {
    /* D8: tokens.css's zero-specificity :where() block is the only ring that
       ships, and .auth-input:focus is the cautionary tale of what a 0-1-1 rule
       does to it product-wide.

       The brief asked for a flat "no :focus rule". That ban and the brief's
       own skip link — "visible on focus only" — cannot both hold, so this
       asserts the thing D8 actually protects instead: no bare :focus rule at
       all, and any :focus-visible rule that does exist may move an element
       but must not touch outline or box-shadow. .welcome-skip is the single
       such rule and it only changes `transform`. */
    expect(CSS).not.toMatch(/:focus(?!-visible)/);
    for (const rule of CSS.match(/[^{}]*:focus-visible[^{}]*\{[^}]*\}/g) ?? []) {
      expect(rule).not.toMatch(/outline|box-shadow/);
    }
  });

  test("the skip link is actually revealed on focus, not merely not-overridden", () => {
    /* The three assertions above are all negative and all pass over an EMPTY
       set: delete .welcome-skip:focus-visible and this file stays green while
       the skip link is off-screen forever. This is the positive half — both
       ends of the affordance, the hiding and the reveal. */
    expect(CSS).toMatch(/\.welcome-skip\s*\{[^}]*transform:\s*translateY\(-/);
    expect(CSS).toMatch(/\.welcome-skip:focus-visible/);
    const reveal = CSS.match(/\.welcome-skip:focus-visible[^{]*\{[^}]*\}/)[0];
    expect(reveal).toMatch(/transform:\s*none/);
  });

  test("no hardcoded hex — colour comes from tokens", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("the reserved red band is off limits on this page", () => {
    expect(CSS).not.toMatch(/var\(--(red|danger|error|stop-[a-z]+)\)/);
  });

  test("reduced motion is handled, and degrades rather than deletes", () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    /* v2: the decorative orbit (a CSS @keyframes animation, degraded here
       via `animation: none`) retired with the rest of the old hero — the
       promoted hero canvas is rAF-driven, not CSS-animated, so its own
       degradation is a JS-side check (GravityPlayground.js's
       prefersReducedMotion(), read once at mount, decides whether the
       render loop starts at all). This file's own share of the RM
       discipline is the transitions below still degrading in the usual
       way — a new exemption idiom this welcomeTokens.test.js file update
       is the brief's own "touch only if the hero pattern genuinely needs
       it" case. */
    expect(CSS).toMatch(/transition:\s*none/);
  });

  test("the page has small-screen handling at all — it had none before", () => {
    expect(CSS).toMatch(/@media \(max-width: 1024px\)/);
    expect(CSS).toMatch(/@media \(max-width: 720px\)/);
  });

  test("the reduced-motion block and the responsive block both sit at the end", () => {
    // Base rules here are unconditional and equal-specificity, so source order
    // decides — same reason platform.css documents at its own tail.
    const firstMedia = CSS.search(/^@media/m);
    expect(firstMedia).toBeGreaterThan(0);
    const tail = CSS.slice(firstMedia);
    expect(tail).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(tail).toMatch(/@media \(max-width:/);
    // Nothing base-level survives after the media region opens.
    const strays = tail.split("\n").filter((l) => /^[.[]/.test(l));
    expect(strays).toEqual([]);
  });

  test("the playground's Play/Pause alias is retired — Task 12 moved the markup", () => {
    // GravityPlayground.js now renders .btn .btn--sm; the page-only
    // .welcome-btn / .welcome-btn--small rules are dead and gone. (The
    // base .welcome-btn aliases in primitives.css are Task 13's to delete.)
    expect(CSS).not.toMatch(/\.welcome-btn\b/);
  });

  /* v2: the boxed "try it" playground — slider, Play/Pause, gravity presets
     — retired in full when GravityPlayground.js was promoted into the
     hero's own full-bleed, ambient canvas (redesign brief: "no slider, no
     play/pause, no presets ... this is decoration behind a title, not a
     control panel"). .welcome-playground__controls and the .range slider
     it hosted no longer exist anywhere on the page, so the two locks below
     — one for each shape the removed markup could have regressed back
     into — replace the old "is the shared .range primitive" positive
     assertion. */
  test("the retired playground's boxed controls do not come back", () => {
    expect(CSS).not.toMatch(/\.welcome-playground__controls\b/);
    expect(CSS).not.toMatch(/input\[type="range"\]/);
  });
});
