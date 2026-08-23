/**
 * Global IDE hotkeys — pure matching, no DOM listeners and no React, so the
 * whole decision table is unit-testable.
 *
 * Deliberately small. Ctrl/Cmd+C is NOT bound: plain Ctrl+C must keep copying
 * selected text, and Ctrl+Shift+C is claimed by Chrome's element inspector.
 * The Export dropdown's "Copy Code to Clipboard" remains the only copy path.
 */

/**
 * `runToggle` rather than `run`: the Run and Stop buttons are ONE button in
 * the viewport header now, and the keyboard matches it. Ctrl/Cmd+Enter used
 * to map to run only, so pressing it while a simulation was already running
 * called handleRun on a live session and appeared to do nothing at all —
 * which is exactly how it was reported. Escape stays stop-only: it is the
 * universal "get me out", and a key that could START a simulation by accident
 * is not what anyone reaches for Escape expecting.
 *
 * @returns {"runToggle"|"save"|"stop"|null}
 */
export function matchHotkey(e) {
  const mod = Boolean(e.ctrlKey || e.metaKey);
  const plainMod = mod && !e.shiftKey && !e.altKey;
  const bare = !mod && !e.shiftKey && !e.altKey;

  if (plainMod && e.key === "Enter") return "runToggle";
  if (bare && e.key === "F5") return "runToggle";
  if (plainMod && (e.key === "s" || e.key === "S")) return "save";
  if (bare && e.key === "Escape") return "stop";
  return null;
}

/**
 * True when the event target is a text-entry surface. Bare keys (Escape, F5)
 * must not fire while a student is typing; modifier chords may, because
 * Ctrl+S inside the code editor should still save the project.
 */
export function isTypingTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], .monaco-host'),
  );
}

/** Modifier name for UI copy. Not a hotkey concern, but the one place both agree. */
export const MOD_LABEL =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "")
    ? "⌘"
    : "Ctrl";
