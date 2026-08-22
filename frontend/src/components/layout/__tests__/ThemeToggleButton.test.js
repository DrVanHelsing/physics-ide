import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import ThemeToggleButton from "../ThemeToggleButton";
import { mountComponent, click, byTitle } from "../../../test/renderHelpers";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("ThemeToggleButton", () => {
  test("renders the sun icon and the light-mode title when isDark is true", () => {
    mounted = mountComponent(<ThemeToggleButton isDark={true} onToggle={vi.fn()} />);
    const btn = byTitle(mounted.container, "Switch to light mode");
    expect(btn).not.toBeNull();
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  test("renders the moon icon and the dark-mode title when isDark is false", () => {
    mounted = mountComponent(<ThemeToggleButton isDark={false} onToggle={vi.fn()} />);
    const btn = byTitle(mounted.container, "Switch to dark mode");
    expect(btn).not.toBeNull();
  });

  test("fires onToggle exactly once per click", () => {
    const onToggle = vi.fn();
    mounted = mountComponent(<ThemeToggleButton isDark={false} onToggle={onToggle} />);
    const btn = byTitle(mounted.container, "Switch to dark mode");
    click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    click(btn);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  test("aria-label equals the title — the button has no visible text of its own", () => {
    mounted = mountComponent(<ThemeToggleButton isDark={true} onToggle={vi.fn()} />);
    const btn = byTitle(mounted.container, "Switch to light mode");
    expect(btn.getAttribute("aria-label")).toBe(btn.getAttribute("title"));
  });
});
