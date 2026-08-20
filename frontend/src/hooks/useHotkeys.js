/**
 * Binds the global IDE hotkeys to a single window listener.
 *
 * `enabled` is false whenever another surface owns the keyboard — the start
 * menu, Help, Debug Mode (which has its own Space/F10/Escape handler at
 * DebugMode.js:162-179) or any open dialog — so the two never fight over Escape.
 */
import { useEffect, useRef } from "react";
import { matchHotkey, isTypingTarget } from "../utils/hotkeys";

export function useHotkeys({ enabled = true, onRun, onStop, onSave }) {
  const handlersRef = useRef(null);
  handlersRef.current = { run: onRun, stop: onStop, save: onSave };

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      const action = matchHotkey(e);
      if (!action) return;
      const bare = !(e.ctrlKey || e.metaKey);
      if (bare && isTypingTarget(e.target)) return;
      const fn = handlersRef.current[action];
      if (typeof fn !== "function") return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
