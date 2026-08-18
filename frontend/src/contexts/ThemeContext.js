/**
 * ThemeContext
 *
 * Manages the VS Code dark / light theme toggle with localStorage persistence.
 * Sets the `data-theme` attribute on `<html>` so all CSS custom-property
 * overrides in styles.css take effect globally.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "../constants";

const ThemeContext = createContext({ isDark: true, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === null ? true : stored === "dark";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      // Ignore write errors (private mode / storage full).
    }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Consume the ThemeContext. Must be called inside a ThemeProvider. */
export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
