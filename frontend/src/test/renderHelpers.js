/**
 * Minimal render-and-click helpers for component tests.
 *
 * Deliberately dependency-free: React 18.3 exports `act` from the "react"
 * package itself and `react-dom/client` provides createRoot, so component
 * tests need no @testing-library/react and no react-dom/test-utils. Keep it
 * that way — a testing library is a dependency decision, not a convenience.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";

/** Mount `ui` into a detached container. Always call unmount() in afterEach. */
export function mountComponent(ui) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Dispatch a bubbling click inside act() so React state settles. */
export function click(el) {
  if (!el) throw new Error("click(): element not found");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Dispatch a bubbling keydown inside act(). */
export function keyDown(el, init) {
  act(() => {
    (el || window).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

/** Find an element by its exact whitespace-collapsed text. */
export function byText(container, text, selector = "button") {
  return (
    [...container.querySelectorAll(selector)].find(
      (el) => el.textContent.replace(/\s+/g, " ").trim() === text,
    ) || null
  );
}

/** Find an element by its title attribute (the IDE labels most icon buttons this way). */
export function byTitle(container, title) {
  return container.querySelector(`[title="${title}"]`);
}
