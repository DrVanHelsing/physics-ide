/**
 * Application-wide constants.
 * Centralises every magic number and string so components, hooks, and
 * utilities all share a single source of truth.
 */

// ── Storage keys ──────────────────────────────────────────────────────────
export const STORAGE_KEY       = "physics-lab-state-v1";
export const THEME_STORAGE_KEY = "physics-ide-theme";

// ── Default values ────────────────────────────────────────────────────────
export const DEFAULT_PYTHON_CODE =
  "# Build your model in blocks, or write VPython here.\n";

// ── Zoom slider ────────────────────────────────────────────────────────────
export const ZOOM_MIN     = 35;
export const ZOOM_MAX     = 200;
export const ZOOM_DEFAULT = 90;

// ── Split-pane (percentage of total width) ───────────────────────────────
export const SPLIT_MIN     = 15;
export const SPLIT_MAX     = 85;
export const SPLIT_DEFAULT = 50;

// ── Trace / debug timings ─────────────────────────────────────────────────
/** Number of historical data-points kept per traced variable. */
export const TRACE_HISTORY_SIZE  = 60;
/** Milliseconds to batch incoming trace messages before a React re-render. */
export const TRACE_DEBOUNCE_MS   = 50;
/** Duration of the block-highlight flash in milliseconds. */
export const HIGHLIGHT_DURATION_MS = 250;

// ── Auto-save ─────────────────────────────────────────────────────────────
/** How often the workspace state is persisted to localStorage (ms). */
export const AUTOSAVE_INTERVAL_MS = 2000;
/** Trailing-debounce delay before an editor change is saved into the active project manifest (ms). */
export const MANIFEST_AUTOSAVE_MS = 3000;

// ── DOM ids ───────────────────────────────────────────────────────────────
/** Container id that glowRunner injects the GlowScript iframe into. */
export const GLOWSCRIPT_HOST_ID = "glowscript-host";

// ── Auth ──────────────────────────────────────────────────────────────────
/* localStorage key: present while the auth layer last knew the user to be
   signed in. Read synchronously by ProjectContext's bootstrap so the legacy
   v1 resurrection doesn't race a signed-in first cloud pull. */
export const SIGNED_IN_HINT_KEY = "pide_signed_in_hint";

// ── Welcome screen ────────────────────────────────────────────────────────
/* sessionStorage key (v2, user directive 2026-08-19): stamped when a visitor
   passes through the welcome screen via one of its CTAs, so "/" renders the
   IDE for the rest of THIS browser session. A new session lands on /welcome
   again; signed-in visitors skip it entirely. */
export const WELCOME_PASSED_SESSION_KEY = "pide_welcome_passed";
