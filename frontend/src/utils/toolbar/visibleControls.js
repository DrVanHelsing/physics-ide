/**
 * The adaptive header's single source of truth: given the project's axes,
 * which control keys exist in which zone. Toolbar renders ONLY what these
 * lists contain — no scattered `showX &&` conditionals in the component.
 *
 * The zoom slider is intentionally absent from every configuration: the
 * on-canvas cluster owns zoom now (Task 11). `trace`/`debug` are reserved
 * slots Plan 4 fills with real handlers; they exist here whenever a sim is
 * live, but Toolbar still no-ops a key whose handler prop is absent.
 */

const SIM_GOALS = new Set(["physics", "hybrid"]);

export const PRIMARY_KEYS = ["run", "stop", "modeToggle"];
export const VIEW_KEYS = ["viewport", "trace", "debug", "reset", "clear", "help"];
export const FILE_KEYS = ["save", "fileMenu", "themeToggle", "signIn", "account"];

export function visibleControls({ mode, goal, role, isTeacher, runState }) {
  const sim = SIM_GOALS.has(goal);
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
      // Reserved slots: Plan 4's debug group fills these. Hidden while idle.
      ...(sim && runState !== "idle" ? ["trace", "debug"] : []),
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
