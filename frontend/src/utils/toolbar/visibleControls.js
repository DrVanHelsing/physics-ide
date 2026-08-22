/**
 * The adaptive header's single source of truth: given the project's axes,
 * which control keys exist in which zone. Toolbar renders ONLY what these
 * lists contain — no scattered `showX &&` conditionals in the component.
 *
 * The zoom slider is intentionally absent from every configuration: the
 * on-canvas cluster owns zoom now (Task 11). `trace`/`debug` were reserved
 * slots Plan 3 left for Plan 4; Task 17 fills them with real handlers, and
 * Toolbar still no-ops a key whose handler prop is absent.
 */

const SIM_GOALS = new Set(["physics", "hybrid"]);

export const PRIMARY_KEYS = ["run", "stop", "modeToggle"];
export const VIEW_KEYS = ["viewport", "trace", "debug", "reset", "clear", "help"];
export const FILE_KEYS = ["save", "fileMenu", "themeToggle", "signIn", "account"];

export function visibleControls({
  mode, goal, role, isTeacher, runState,
  /* Their own state keeps these two alive past the end of a run — see the
     view zone below. */
  debugMode = false,
  traceVisible = false,
}) {
  const sim = SIM_GOALS.has(goal);
  const live = runState !== "idle";
  return {
    primary: [
      ...(sim && runState !== "running" ? ["run"] : []),
      ...(sim && runState !== "idle" ? ["stop"] : []),
      "modeToggle",
    ],
    view: [
      // zoom slider intentionally absent from every configuration — the
      // on-canvas cluster owns zoom (Task 11).
      ...(sim ? ["viewport"] : []),
      /* Hidden while idle — there is nothing to trace or debug yet. But once
         either is ON it must STAY on screen even after the run ends: Stop
         while debugging would otherwise take Exit Debug away with it and
         strand the student inside a mode with no way out, and the same Stop
         would leave a self-opened drawer with no control to close it. */
      ...(sim && (live || traceVisible || debugMode) ? ["trace"] : []),
      ...(sim && (live || debugMode) ? ["debug"] : []),
      "reset",
      ...(mode === "blocks" ? ["clear"] : []),
      "help",
    ],
    file: [
      "save",
      "fileMenu",
      "themeToggle",
      ...(role === "guest" ? ["signIn"] : ["account"]),
      // Teacher classroom controls: no key yet — the slot is the isTeacher
      // parameter itself, so the classroom plans add their control as a
      // one-line matrix change, not an API change.
    ],
  };
}
