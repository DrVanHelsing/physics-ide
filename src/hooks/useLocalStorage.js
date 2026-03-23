import { useState, useCallback } from "react";

/**
 * A drop-in replacement for `useState` that automatically persists the value
 * to `localStorage` under `key`.
 *
 * @param {string}  key          - The localStorage key.
 * @param {*}       initialValue - Fallback value when nothing is stored yet.
 * @returns {[*, Function]}  Current value + stable setter (same API as useState).
 */
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Ignore write errors (private mode / storage full).
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

export default useLocalStorage;
