/**
 * The adaptive header's single source of truth: given the project's axes,
 * which control keys exist in which zone. Every keyed control in the header
 * comes from these lists — no scattered `showX &&` conditionals in the
 * component.
 *
 * There is no longer an exception for the debug group. It used to be rendered
 * inline by Toolbar behind a bare `{debugMode && …}` because it had no place
 * in any zone's ordering; it now lives in the viewport pane header with the
 * rest of the simulation controls (components/SimControls.js), so the header
 * really is nothing but these three lists.
 *
 * The zoom slider is intentionally absent from every configuration: the
 * on-canvas cluster owns zoom now (Task 11). `trace`/`debug` were reserved
 * slots Plan 3 left for Plan 4; Task 17 fills them with real handlers, and
 * Toolbar still no-ops a key whose handler prop is absent.
 */

const SIM_GOALS = new Set(["physics", "hybrid"]);

/* `run` and `stop` are gone from here: every simulation control now lives in
   the viewport's own pane header (components/SimControls.js), as one Run/Stop
   toggle rather than two mutually-exclusive buttons. The header keeps what
   acts on the PROJECT — menu, save, editor mode, help, account — and the
   debug group moved with them, which is what actually cured the squash: that
   group is deliberately non-collapsible, so turning debug on used to force
   six more controls into an already-full row. */
export const PRIMARY_KEYS = ["modeToggle"];
export const VIEW_KEYS = ["viewport", "trace", "debug", "reset", "clear", "help"];
export const FILE_KEYS = ["save", "fileMenu", "themeToggle", "signIn", "account"];

export function visibleControls({
  mode, goal, role, runState,
  isTeacher, // eslint-disable-line no-unused-vars -- reserved API slot for classroom teacher controls, see comment below
  /* Their own state keeps these two alive past the end of a run — see the
     view zone below. */
  debugMode = false,
  traceVisible = false,
  /* Task 12: a teacher's per-assignment WorkspaceRules, or null outside
     assignment work (free project, guest, or an assignment with no rules
     record) — null is EXACTLY today's behaviour, every axis below untouched.
     Only two things are rule-governed here: whether the mode toggle exists
     at all (`editors` restricted to one surface) and whether `debug` may
     ever appear (it beats both of the keep-alive axes above). Everything
     else — trace, reset, clear, help, the whole file zone — is unaffected;
     import/export item visibility is gated at the item level in Toolbar,
     not here, because save/fileMenu themselves must always stay. */
  rules = null,
  /* Plan 10 win 3: the reset slot is no longer unconditional — it exists
     ONLY as the hybrid analyse return ("Back to Simulation"), keyed off
     the stash the analyse flow parks in the manifest. */
  analysisReturn = false,
}) {
  const sim = SIM_GOALS.has(goal);
  const live = runState !== "idle";
  let view = [
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
    ...(analysisReturn ? ["reset"] : []),
    ...(mode === "blocks" ? ["clear"] : []),
    "help",
  ];
  if (rules && !rules.debug) view = view.filter((k) => k !== "debug");

  return {
    primary: rules && rules.editors !== "both" ? [] : ["modeToggle"],
    view,
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
