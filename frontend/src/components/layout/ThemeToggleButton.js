import React from "react";
import { SunIcon, MoonIcon } from "../Icons";

/**
 * The one theme toggle. Extracted from Toolbar's CONTROL_RENDERERS so the
 * portal header and the front page can mount it too — until now `useTheme()`
 * was consumed in exactly two places and a visitor on /welcome, /auth/*,
 * /classes, /profile or /admin had no way to switch (spec §18 D9).
 *
 * Stateless on purpose: the IDE header already holds isDark/onToggle as
 * props, and portal surfaces read them straight from useTheme().
 */
export default function ThemeToggleButton({ isDark, onToggle, className = "tb-btn tb-btn--icon tb-btn--theme" }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
    </button>
  );
}
